// PRIVILEGED Supabase client: SERVER ONLY. It is used for exactly one purpose, inviting a new team
// member (auth.admin.inviteUserByEmail) and checking whether an invitation was completed, and only
// after requireOwner() has passed. It must never be imported from a "use client" file or from a
// module that is.
//
// It reads its OWN variable, SUPABASE_TEAM_ADMIN_KEY, on purpose: SUPABASE_SECRET_KEY is the optional
// lead-intake credential (Option A) and setting both is rejected as a configuration conflict
// (src/features/leads/config.ts, scripts/check-env.mjs). Returns null when it is not configured, so
// callers can say so honestly instead of pretending an invitation was sent.
import { createClient } from "@supabase/supabase-js";

export function createTeamAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_TEAM_ADMIN_KEY;
  if (!url || !key || key.startsWith("sb_publishable_")) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
