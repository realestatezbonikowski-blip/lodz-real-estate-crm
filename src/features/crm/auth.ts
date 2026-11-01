import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { decideMfaAccess, parseMode } from "@/features/mfa/policy";
import { loadMfaState } from "@/features/mfa/state";

export type StaffProfile = { id: string; full_name: string; role: "owner" | "assistant"; is_active: boolean };

/**
 * The authorization gate for every admin page and server action.
 *
 *  - getUser() asks the Auth server to validate the session (the cookie alone is never trusted).
 *  - The role comes ONLY from the `profiles` table, never from JWT metadata a user can edit.
 *  - A signed-in user without an active profile gets nothing (RLS also returns nothing for them).
 *  - MFA: a user who HAS a verified second factor must complete it (aal2) before any CRM page or action
 *    works. Policy comes from MFA_MODE (off | enrolled | required); unset = "enrolled": enrolled users are
 *    always challenged, users without a factor are not forced to enrol. Unknown values fail closed.
 * Cached per request so layout and page do not repeat the two round trips.
 */
export const requireStaff = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/admin/login");

  const mfa = await loadMfaState(supabase, data.user);
  const decision = decideMfaAccess({
    mode: parseMode(process.env.MFA_MODE || "enrolled"),
    currentLevel: mfa.signedIn ? mfa.currentLevel : null,
    nextLevel: null,
    hasVerifiedFactor: mfa.signedIn && mfa.hasVerifiedFactor,
  });
  if (decision === "challenge") redirect("/admin/mfa");
  if (decision === "enrol") redirect("/admin/security");
  if (decision === "deny") redirect("/admin/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", data.user.id)
    .maybeSingle<StaffProfile>();
  if (!profile || !profile.is_active) redirect("/admin/login?error=no-access");

  return { supabase, user: data.user, profile };
});

export async function requireOwner() {
  const ctx = await requireStaff();
  if (ctx.profile.role !== "owner") redirect("/admin/leads?error=forbidden");
  return ctx;
}
