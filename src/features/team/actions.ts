"use server";

// Team management (owner only) and invitation acceptance. Every owner action starts with
// requireOwner() (which also applies the MFA gate); the privileged client is created only after that.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getT } from "@/features/admin-prefs/server";
import { issueText } from "@/features/admin-prefs/translate";
import { requireOwner } from "@/features/crm/auth";
import { activeSchema, fieldErrors, inviteSchema, passwordSchema, type ActionResult } from "@/features/crm/schema";
import { createTeamAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function inviteOpiekun(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireOwner();
  const { t } = await getT();
  const parsed = inviteSchema.safeParse({ email: text(formData, "email"), fullName: text(formData, "fullName") });
  if (!parsed.success) return { ok: false, message: issueText(t, parsed.error.issues[0]?.message, "common.checkForm"), fields: fieldErrors(parsed.error) };

  const admin = createTeamAdminClient();
  if (!admin) return { ok: false, message: t("team.msg.noKey", { key: "SUPABASE_TEAM_ADMIN_KEY" }) };

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, { redirectTo: `${site}/admin/auth/confirm` });
  if (error || !data.user) {
    return { ok: false, message: t("team.msg.inviteFailed") };
  }

  // The profile is what grants CRM access, and the role is always the least-privileged one.
  const { error: pErr } = await supabase.from("profiles").insert({ id: data.user.id, full_name: parsed.data.fullName, role: "assistant", is_active: true });
  if (pErr) {
    await admin.auth.admin.deleteUser(data.user.id); // remove the half-created account (it was created a moment ago by this invite)
    return { ok: false, message: t("team.msg.profileFailed") };
  }
  revalidatePath("/admin/team");
  return { ok: true, message: t("team.msg.inviteSent", { email: parsed.data.email }) };
}

export async function setMemberActive(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireOwner();
  const { t } = await getT();
  const parsed = activeSchema.safeParse({ userId: text(formData, "userId"), active: text(formData, "active") });
  if (!parsed.success) return { ok: false, message: t("team.msg.invalid") };
  if (parsed.data.userId === user.id) return { ok: false, message: t("team.msg.selfStatus") };

  const { data, error } = await supabase.from("profiles").update({ is_active: parsed.data.active }).eq("id", parsed.data.userId).select("id");
  if (error || !data?.length) return { ok: false, message: t("team.msg.saveFailed") };
  revalidatePath("/admin/team");
  return { ok: true, message: parsed.data.active ? t("team.msg.activated") : t("team.msg.deactivated") };
}

/** Invitation acceptance: the invited person (signed in by /admin/auth/confirm) chooses a password. */
export async function setPassword(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/admin/login");
  const { t } = await getT();
  const parsed = passwordSchema.safeParse({ password: text(formData, "password"), confirm: text(formData, "confirm") });
  if (!parsed.success) return { ok: false, message: issueText(t, parsed.error.issues[0]?.message, "common.checkForm"), fields: fieldErrors(parsed.error) };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, message: t("team.msg.pwFailed") };
  redirect("/admin/leads"); // outside any try: redirect() works by throwing
}
