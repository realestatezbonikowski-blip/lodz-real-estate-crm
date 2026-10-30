"use server";

// Server Actions for the CRM. Each one re-checks the session and role (requireStaff / requireOwner),
// validates its input with Zod, and writes through RLS as the signed-in user. An update or delete
// that RLS filters out affects zero rows, which is reported as "no permission", never as success.
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createRateLimiter } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOwner, requireStaff } from "./auth";
import { activitySchema, assignSchema, contactSchema, fieldErrors, manualLeadSchema, statusSchema, type ActionResult } from "./schema";

const NO_RIGHTS: ActionResult = { ok: false, message: "Nie udało się zapisać zmiany. Brak uprawnień lub lead już nie istnieje." };
const FAILED: ActionResult = { ok: false, message: "Nie udało się zapisać zmiany. Spróbuj ponownie." };
const idSchema = z.string().uuid();

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "");

// Best-effort brute-force brake in front of Supabase Auth's own limits (per server instance).
const loginLimiter = createRateLimiter({ windowMs: 10 * 60_000, max: 10, maxKeys: 2000 });

export async function signIn(formData: FormData): Promise<void> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!loginLimiter.check(ip).allowed) redirect("/admin/login?error=rate");

  const parsed = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(1).max(200) })
    .safeParse({ email: text(formData, "email"), password: text(formData, "password") });
  if (!parsed.success) redirect("/admin/login?error=invalid");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  // One generic message for every failure: no hint whether the account exists.
  if (error) redirect("/admin/login?error=invalid");
  redirect("/admin/leads");
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export async function updateLeadStatus(leadId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  if (!idSchema.safeParse(leadId).success) return FAILED;
  const parsed = statusSchema.safeParse({ status: text(formData, "status") });
  if (!parsed.success) return { ok: false, message: "Wybierz poprawny status." };

  const { data, error } = await supabase.from("leads").update({ status: parsed.data.status }).eq("id", leadId).select("id");
  if (error) return FAILED;
  if (!data?.length) return NO_RIGHTS;
  revalidatePath(`/admin/leads/${leadId}`);
  return { ok: true, message: "Status zapisany." };
}

export async function assignLead(leadId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  if (!idSchema.safeParse(leadId).success) return FAILED;
  const parsed = assignSchema.safeParse({ assignedTo: text(formData, "assignedTo") });
  if (!parsed.success) return { ok: false, message: "Wybierz poprawną osobę." };

  const { data, error } = await supabase.from("leads").update({ assigned_to: parsed.data.assignedTo }).eq("id", leadId).select("id");
  if (error) return FAILED;
  if (!data?.length) return NO_RIGHTS;
  revalidatePath(`/admin/leads/${leadId}`);
  return { ok: true, message: "Przypisanie zapisane." };
}

export async function addActivity(leadId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireStaff();
  if (!idSchema.safeParse(leadId).success) return FAILED;
  const parsed = activitySchema.safeParse({ type: text(formData, "type"), body: text(formData, "body") });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Sprawdź formularz.", fields: fieldErrors(parsed.error) };

  // actor_id must be the caller (enforced by the INSERT policy as well); time and status fields are not settable.
  const { error } = await supabase.from("lead_activities").insert({ lead_id: leadId, type: parsed.data.type, body: parsed.data.body, actor_id: user.id });
  if (error) return FAILED;
  revalidatePath(`/admin/leads/${leadId}`);
  return { ok: true, message: "Wpis dodany." };
}

export async function updateContact(leadId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  if (!idSchema.safeParse(leadId).success) return FAILED;
  const parsed = contactSchema.safeParse({
    firstName: text(formData, "firstName"), lastName: text(formData, "lastName"),
    phone: text(formData, "phone"), email: text(formData, "email"),
  });
  if (!parsed.success) return { ok: false, message: "Sprawdź zaznaczone pola.", fields: fieldErrors(parsed.error) };

  const { firstName, lastName, phone, email } = parsed.data;
  const { data, error } = await supabase.from("leads").update({ first_name: firstName, last_name: lastName, phone, email }).eq("id", leadId).select("id");
  if (error) return FAILED; // includes a table CHECK violation
  if (!data?.length) return NO_RIGHTS;
  revalidatePath(`/admin/leads/${leadId}`);
  return { ok: true, message: "Dane kontaktowe zapisane." }; // the change (field names only) is audited by a trigger
}

export async function setArchived(leadId: string, archive: boolean): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  if (!idSchema.safeParse(leadId).success) return FAILED;
  const { data, error } = await supabase.from("leads").update({ archived_at: archive ? new Date().toISOString() : null }).eq("id", leadId).select("id");
  if (error) return FAILED;
  if (!data?.length) return NO_RIGHTS;
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin/leads");
  return { ok: true, message: archive ? "Lead zarchiwizowany." : "Lead przywrócony." };
}

export async function createManualLead(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireStaff();
  const parsed = manualLeadSchema.safeParse({
    firstName: text(formData, "firstName"), lastName: text(formData, "lastName"),
    phone: text(formData, "phone"), email: text(formData, "email"),
    message: text(formData, "message"), projectId: text(formData, "projectId"),
  });
  if (!parsed.success) return { ok: false, message: "Sprawdź zaznaczone pola.", fields: fieldErrors(parsed.error) };

  // source/created_by are required by the INSERT policy; web-attribution columns are not grantable.
  const d = parsed.data;
  const { data, error } = await supabase
    .from("leads")
    .insert({ first_name: d.firstName, last_name: d.lastName, phone: d.phone, email: d.email, message: d.message ?? null, project_id: d.projectId, locale: "pl", source: "manual", created_by: user.id })
    .select("id")
    .single();
  if (error || !data) return FAILED;
  revalidatePath("/admin/leads");
  redirect(`/admin/leads/${data.id}`);
}

export async function deleteLead(leadId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireOwner(); // owners only; RLS enforces it again
  if (!idSchema.safeParse(leadId).success) return FAILED;
  if (text(formData, "confirm") !== "on") return { ok: false, message: "Zaznacz potwierdzenie, aby usunąć lead." };

  const { data, error } = await supabase.from("leads").delete().eq("id", leadId).select("id"); // audited by a trigger
  if (error) return FAILED;
  if (!data?.length) return NO_RIGHTS;
  revalidatePath("/admin/leads");
  redirect("/admin/leads?deleted=1");
}
