// Verifying a TOTP code, as a pure function with injected dependencies (no Next.js, no network), so
// the ORDER of operations is testable: rate limit first, auth server second.
//
// Rate limiting reuses the login guard (src/lib/security/login-guard.ts). A 6-digit code has only a
// million values, so the budget is tighter than for passwords:
//   per account  5 wrong codes / 15 min   (the account key is a keyed hash of the user id)
//   per client  10 attempts   / 15 min   (only when a TRUSTED client address is known)
// Attempts are counted before the code is checked; a correct code and an outage give theirs back.
// Blocked attempts never reach the auth server. Accounts and clients are isolated from each other.
import { createLoginGuard, type GuardConfig, type LoginGuard } from "../../lib/security/login-guard.ts";

export type VerifyOutcome = "ok" | "invalid" | "rate" | "unavailable";

export const MFA_GUARD_CONFIG: GuardConfig = {
  client: { max: 10, windowMs: 15 * 60_000 },
  account: { max: 5, windowMs: 15 * 60_000 },
  maxKeys: 5000,
};

export const newMfaGuard = () => createLoginGuard(MFA_GUARD_CONFIG);

/** Accepts "123456", "123 456" and "123-456". Anything else is not a code. */
export function normaliseCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const compact = input.replace(/[\s-]/g, "");
  return /^\d{6}$/.test(compact) ? compact : null;
}

/** Maps an auth-server error onto what the user may be told. The original message is never shown. */
export function classifyMfaError(error: { status?: number; name?: string; code?: string } | null): VerifyOutcome {
  if (!error) return "ok";
  if (error.status === 429 || error.code === "over_request_rate_limit") return "rate";
  if (error.name === "AuthRetryableFetchError" || (typeof error.status === "number" && (error.status >= 500 || error.status === 0))) return "unavailable";
  return "invalid"; // wrong code, expired challenge, unknown factor: all look the same
}

export async function attemptMfaVerify(
  deps: { guard: LoginGuard; verify: (code: string) => Promise<VerifyOutcome>; now?: () => number },
  input: { userId: string; code: unknown; clientKey?: string },
): Promise<VerifyOutcome> {
  const now = deps.now?.() ?? Date.now();
  const begin = deps.guard.begin({ client: input.clientKey, account: deps.guard.accountKey(`mfa:${input.userId}`) }, now);
  if (!begin.allowed) return "rate";

  const code = normaliseCode(input.code);
  if (code === null) return "invalid"; // still counted: malformed input is not free

  let result: VerifyOutcome;
  try {
    result = await deps.verify(code);
  } catch {
    result = "unavailable";
  }
  if (result === "ok" || result === "unavailable") deps.guard.release(begin.ticket, now);
  return result;
}
