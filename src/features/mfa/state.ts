// Reads the caller's MFA state from SERVER-VALIDATED sources, never from a cookie alone:
//   * getUser() asks the Auth server to validate the session and returns the CURRENT factor list
//     (so a factor removed elsewhere, or a revoked session, is reflected immediately);
//   * getClaims() then verifies the access token's signature (ES256 on this project, via the public
//     JWKS) or, for a symmetric token, confirms it with the auth server, and only then returns the
//     `aal` and `amr` claims.
// The level reported by auth.mfa.getAuthenticatorAssuranceLevel() is deliberately NOT used: it
// decodes the stored token without checking its signature and reads a cached factor list.
//
// This module never touches an application table (profiles, leads, ...): the MFA screens must work
// for an aal1 session even after database-level MFA enforcement is switched on.
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { parseAal, parseAmr, type Aal, type AmrEntry } from "./policy.ts";

export type FactorInfo = {
  id: string;
  type: string;
  status: "verified" | "unverified";
  friendlyName: string;
  createdAt: string;
};

export type MfaState =
  | { signedIn: false }
  | {
      signedIn: true;
      userId: string;
      email: string | null;
      /** null = the claim was missing, unreadable or not exactly "aal1"/"aal2" (treated as unknown, never as aal1). */
      currentLevel: Aal | null;
      amr: AmrEntry[];
      factors: FactorInfo[];
      verifiedTotp: FactorInfo[];
      hasVerifiedFactor: boolean;
    };

export function parseFactors(user: Pick<User, "factors">): FactorInfo[] {
  const out: FactorInfo[] = [];
  for (const f of user.factors ?? []) {
    if (typeof f?.id !== "string" || (f.status !== "verified" && f.status !== "unverified")) continue;
    out.push({
      id: f.id,
      type: String(f.factor_type),
      status: f.status,
      friendlyName: typeof f.friendly_name === "string" && f.friendly_name ? f.friendly_name : "Aplikacja uwierzytelniająca",
      createdAt: typeof f.created_at === "string" ? f.created_at : "",
    });
  }
  return out;
}

/** `known` = a user the caller has JUST validated with getUser() on this client (saves a round trip). */
export async function loadMfaState(supabase: SupabaseClient, known?: User): Promise<MfaState> {
  let user = known;
  if (!user) {
    const { data: u, error } = await supabase.auth.getUser();
    if (error || !u.user) return { signedIn: false };
    user = u.user;
  }
  const u = { user };

  const { data: c } = await supabase.auth.getClaims();
  const claims = c?.claims as { sub?: unknown; aal?: unknown; amr?: unknown } | undefined;
  // The claims must belong to the same user the server just validated.
  const trusted = claims && claims.sub === u.user.id;

  const factors = parseFactors(u.user);
  const verifiedTotp = factors.filter((f) => f.status === "verified" && f.type === "totp");
  return {
    signedIn: true,
    userId: u.user.id,
    email: u.user.email ?? null,
    currentLevel: trusted ? parseAal(claims.aal) : null,
    amr: trusted ? parseAmr(claims.amr) : [],
    factors,
    verifiedTotp,
    hasVerifiedFactor: factors.some((f) => f.status === "verified"),
  };
}
