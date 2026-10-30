import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type StaffProfile = { id: string; full_name: string; role: "owner" | "assistant"; is_active: boolean };

/**
 * The authorization gate for every admin page and server action.
 *
 *  - getUser() asks the Auth server to validate the session (the cookie alone is never trusted).
 *  - The role comes ONLY from the `profiles` table, never from JWT metadata a user can edit.
 *  - A signed-in user without an active profile gets nothing (RLS also returns nothing for them).
 * Cached per request so layout and page do not repeat the two round trips.
 */
export const requireStaff = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/admin/login");

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
