// The sign-in decision, as a pure function with injected dependencies (no Next.js, no network), so
// the ORDER of operations is testable: guard first, auth server second.
//
//   1. Validate the shape of the input (a bad shape still costs the client an attempt).
//   2. guard.begin(): refuse with "rate" if the client or the account is over its limit. The auth
//      server is NOT contacted in that case, which also protects the shared budget Supabase applies
//      to our server's address.
//   3. Ask the auth server. Success and outages give the attempt back; only real credential failures
//      stay counted.
//
// Every credential failure, for an existing or a non-existing account, produces the same outcome.
import { z } from "zod";
import type { LoginGuard } from "../../lib/security/login-guard.ts";

export type LoginOutcome = "ok" | "invalid" | "rate" | "unavailable";
export type AuthResult = "ok" | "invalid" | "rate" | "unavailable";

const credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

/** Maps a Supabase Auth error onto what the user may be told. Never exposes the original message. */
export function classifyAuthError(error: { status?: number; name?: string; code?: string } | null): AuthResult {
  if (!error) return "ok";
  if (error.status === 429 || error.code === "over_request_rate_limit" || error.code === "over_email_send_rate_limit") return "rate";
  if (error.name === "AuthRetryableFetchError" || (typeof error.status === "number" && (error.status >= 500 || error.status === 0))) return "unavailable";
  return "invalid"; // wrong password, unknown e-mail, unconfirmed account: all look the same
}

export async function attemptLogin(
  deps: { guard: LoginGuard; authenticate: (email: string, password: string) => Promise<AuthResult>; now?: () => number },
  input: { email: string; password: string; clientKey?: string },
): Promise<LoginOutcome> {
  const now = deps.now?.() ?? Date.now();
  const parsed = credentials.safeParse({ email: input.email, password: input.password });

  // Without a valid e-mail there is no account key; the client key (if known) still counts the attempt.
  const begin = deps.guard.begin(
    { client: input.clientKey, account: parsed.success ? deps.guard.accountKey(parsed.data.email) : undefined },
    now,
  );
  if (!begin.allowed) return "rate";
  if (!parsed.success) return "invalid";

  let result: AuthResult;
  try {
    result = await deps.authenticate(parsed.data.email, parsed.data.password);
  } catch {
    result = "unavailable";
  }

  if (result === "ok" || result === "unavailable") deps.guard.release(begin.ticket, now);
  return result;
}
