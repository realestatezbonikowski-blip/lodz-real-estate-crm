"use server";

// Server Actions for the CRM. Each one re-checks the session and role (requireStaff / requireOwner),
// validates its input with Zod, and writes through RLS as the signed-in user. An update or delete
// that RLS filters out affects zero rows, which is reported as "no permission", never as success.
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Translate } from "@/features/admin-prefs/core";
import { getT } from "@/features/admin-prefs/server";
import { issueText } from "@/features/admin-prefs/translate";
import { trustedClientKey } from "@/lib/security/client-ip";
import { createLoginGuard } from "@/lib/security/login-guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOwner, requireStaff } from "./auth";
import { attemptLogin, classifyAuthError } from "./login";
import { activitySchema, assignSchema, contactSchema, fieldErrors, followUpSchema, manualLeadSchema, statusSchema, type ActionResult } from "./schema";

const noRights = (t: Translate): ActionResult => ({ ok: false, message: t("common.noRights") });
const failed = (t: Translate): ActionResult => ({ ok: false, message: t("common.saveFailed") });
const idSchema = z.string().uuid();

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "");

// Brute-force guard (per server process; see src/lib/security/login-guard.ts for what it does and
// what it cannot do across instances). Not exported: a "use server" module exports actions only.
const loginGuard = createLoginGuard();

export async function signIn(formData: FormData): Promise<void> {
  // A client address is used only if the deployment declares which header its trusted proxy sets
  // (TRUSTED_PROXY_HEADER). Otherwise there is no per-client key and only the per-account limit applies.
  const clientKey = trustedClientKey(await headers(), process.env);

  const outcome = await attemptLogin(
    {
      guard: loginGuard,
      authenticate: async (email, password) => {
        const supabase = await createSupabaseServerClient();
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return classifyAuthError(error);
      },
    },
    { email: text(formData, "email"), password: text(formData, "password"), clientKey },
  );

  // One generic message for every credential failure: no hint whether the account exists.
  if (outcome !== "ok") redirect(`/admin/login?error=${outcome}`);
  redirect("/admin/leads");
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export async function updateLeadStatus(leadId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { t } = await getT();
  if (!idSchema.safeParse(leadId).success) return failed(t);
  const parsed = statusSchema.safeParse({ status: text(formData, "status") });
  if (!parsed.success) return { ok: false, message: t("msg.pickStatus") };

  const { data, error } = await supabase.from("leads").update({ status: parsed.data.status }).eq("id", leadId).select("id");
  if (error) return failed(t);
  if (!data?.length) return noRights(t);
  revalidatePath(`/admin/leads/${leadId}`);
  return { ok: true, message: t("msg.statusSaved") };
}

export async function assignLead(leadId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { t } = await getT();
  if (!idSchema.safeParse(leadId).success) return failed(t);
  const parsed = assignSchema.safeParse({ assignedTo: text(formData, "assignedTo") });
  if (!parsed.success) return { ok: false, message: t("msg.pickPerson") };

  const { data, error } = await supabase.from("leads").update({ assigned_to: parsed.data.assignedTo }).eq("id", leadId).select("id");
  if (error) return failed(t);
  if (!data?.length) return noRights(t);
  revalidatePath(`/admin/leads/${leadId}`);
  return { ok: true, message: t("msg.assignSaved") };
}

export async function setFollowUp(leadId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { t } = await getT();
  if (!idSchema.safeParse(leadId).success) return failed(t);
  const parsed = followUpSchema.safeParse({ followUpOn: text(formData, "followUpOn"), nextAction: text(formData, "nextAction") });
  if (!parsed.success) return { ok: false, message: issueText(t, parsed.error.issues[0]?.message, "common.checkForm"), fields: fieldErrors(parsed.error) };

  const { data, error } = await supabase
    .from("leads")
    .update({ follow_up_on: parsed.data.followUpOn, next_action: parsed.data.nextAction })
    .eq("id", leadId)
    .select("id");
  // 42703 = the follow-up migration has not been applied to this database yet.
  if (error?.code === "42703" || error?.code === "PGRST204") return { ok: false, message: t("msg.followMigration") };
  if (error) return failed(t);
  if (!data?.length) return noRights(t);
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin/leads");
  return { ok: true, message: parsed.data.followUpOn ? t("msg.followSaved") : t("msg.followCleared") };
}

export async function addActivity(leadId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireStaff();
  const { t } = await getT();
  if (!idSchema.safeParse(leadId).success) return failed(t);
  const parsed = activitySchema.safeParse({ type: text(formData, "type"), body: text(formData, "body") });
  if (!parsed.success) return { ok: false, message: issueText(t, parsed.error.issues[0]?.message, "common.checkForm"), fields: fieldErrors(parsed.error) };

  // actor_id must be the caller (enforced by the INSERT policy as well); time and status fields are not settable.
  const { error } = await supabase.from("lead_activities").insert({ lead_id: leadId, type: parsed.data.type, body: parsed.data.body, actor_id: user.id });
  if (error) return failed(t);
  revalidatePath(`/admin/leads/${leadId}`);
  return { ok: true, message: t("msg.entryAdded") };
}

export async function updateContact(leadId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { t } = await getT();
  if (!idSchema.safeParse(leadId).success) return failed(t);
  const parsed = contactSchema.safeParse({
    firstName: text(formData, "firstName"), lastName: text(formData, "lastName"),
    phone: text(formData, "phone"), email: text(formData, "email"),
  });
  if (!parsed.success) return { ok: false, message: t("common.checkFields"), fields: fieldErrors(parsed.error) };

  const { firstName, lastName, phone, email } = parsed.data;
  const { data, error } = await supabase.from("leads").update({ first_name: firstName, last_name: lastName, phone, email }).eq("id", leadId).select("id");
  if (error) return failed(t); // includes a table CHECK violation
  if (!data?.length) return noRights(t);
  revalidatePath(`/admin/leads/${leadId}`);
  return { ok: true, message: t("msg.contactSaved") }; // the change (field names only) is audited by a trigger
}

export async function setArchived(leadId: string, archive: boolean): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { t } = await getT();
  if (!idSchema.safeParse(leadId).success) return failed(t);
  const { data, error } = await supabase.from("leads").update({ archived_at: archive ? new Date().toISOString() : null }).eq("id", leadId).select("id");
  if (error) return failed(t);
  if (!data?.length) return noRights(t);
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin/leads");
  return { ok: true, message: archive ? t("msg.archived") : t("msg.restored") };
}

export async function createManualLead(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireStaff();
  const { t } = await getT();
  const parsed = manualLeadSchema.safeParse({
    firstName: text(formData, "firstName"), lastName: text(formData, "lastName"),
    phone: text(formData, "phone"), email: text(formData, "email"),
    message: text(formData, "message"), projectId: text(formData, "projectId"),
  });
  if (!parsed.success) return { ok: false, message: t("common.checkFields"), fields: fieldErrors(parsed.error) };

  // source/created_by are required by the INSERT policy; web-attribution columns are not grantable.
  const d = parsed.data;
  const { data, error } = await supabase
    .from("leads")
    .insert({ first_name: d.firstName, last_name: d.lastName, phone: d.phone, email: d.email, message: d.message ?? null, project_id: d.projectId, locale: "pl", source: "manual", created_by: user.id })
    .select("id")
    .single();
  if (error || !data) return failed(t);
  revalidatePath("/admin/leads");
  redirect(`/admin/leads/${data.id}`);
}

export async function deleteLead(leadId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireOwner(); // owners only; RLS enforces it again
  const { t } = await getT();
  if (!idSchema.safeParse(leadId).success) return failed(t);
  if (text(formData, "confirm") !== "on") return { ok: false, message: t("msg.confirmDelete") };

  const { data, error } = await supabase.from("leads").delete().eq("id", leadId).select("id"); // audited by a trigger
  if (error) return failed(t);
  if (!data?.length) return noRights(t);
  revalidatePath("/admin/leads");
  redirect("/admin/leads?deleted=1");
}
