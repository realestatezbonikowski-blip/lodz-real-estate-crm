import type { SupabaseClient } from "@supabase/supabase-js";

export type TeamMember = { id: string; full_name: string; role: "owner" | "assistant"; is_active: boolean; created_at: string; openLeads: number };
export type InviteState = { email: string | null; state: "active" | "invited" | "unknown" };

export async function listTeam(db: SupabaseClient): Promise<TeamMember[] | null> {
  const { data, error } = await db.from("profiles").select("id, full_name, role, is_active, created_at").order("created_at");
  if (error) return null;
  const members = (data ?? []) as Omit<TeamMember, "openLeads">[];
  const counts = await Promise.all(
    members.map((m) => db.from("leads").select("id", { count: "exact", head: true }).eq("assigned_to", m.id).is("archived_at", null)),
  );
  return members.map((m, i) => ({ ...m, openLeads: counts[i]?.count ?? 0 }));
}

type AdminLike = {
  auth: { admin: { getUserById(id: string): Promise<{ data: { user: { email?: string | null; last_sign_in_at?: string | null } | null } }> } };
};

/** Owner-only, needs the privileged client: has the person completed the invitation (signed in at least once)? */
export async function inviteStates(admin: AdminLike, ids: string[]): Promise<Map<string, InviteState>> {
  const out = new Map<string, InviteState>();
  await Promise.all(
    ids.map(async (id) => {
      try {
        const { data } = await admin.auth.admin.getUserById(id);
        const u = data.user;
        out.set(id, { email: u?.email ?? null, state: !u ? "unknown" : u.last_sign_in_at ? "active" : "invited" });
      } catch {
        out.set(id, { email: null, state: "unknown" });
      }
    }),
  );
  return out;
}
