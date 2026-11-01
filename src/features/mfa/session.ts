import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadMfaState } from "./state";

/**
 * Gate for the MFA screens and actions: a valid, server-validated session, nothing more.
 * It deliberately reads NO application table (no profiles, no leads), so these screens keep working
 * for an aal1 session even after database-level MFA enforcement is switched on, and a user can
 * always reach them to enrol or to answer a challenge.
 */
export const requireMfaSession = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const state = await loadMfaState(supabase);
  if (!state.signedIn) redirect("/admin/login");
  return { supabase, state };
});
