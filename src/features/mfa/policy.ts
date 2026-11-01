// MFA policy as pure, fail-closed functions. Nothing here touches the network, cookies or the
// database, so every branch is covered by table-driven tests (policy.test.ts).
//
// STATUS: these decisions are NOT wired into requireStaff()/requireOwner() or the database yet (a
// later, separately approved rollout step). Today they are used only by the /admin/security and
// /admin/mfa screens. Users without an enrolled factor keep the existing login behaviour.
//
// Principles
//   * Levels are compared by strict equality with "aal1" / "aal2". Anything else (null, a number,
//     "AAL2", " aal2 ", a future value) is "unknown" and never grants anything.
//   * Callers must pass levels and timestamps taken from SERVER-VALIDATED claims (state.ts reads
//     them with getClaims(), which verifies the token signature, after getUser() validated the
//     session). Never feed this module values decoded from a cookie without verification.
//   * "Conservative" wins when inputs disagree: if either the factor list or the next level says a
//     second factor exists, the session is treated as needing it.

export type Aal = "aal1" | "aal2";

export function parseAal(value: unknown): Aal | null {
  return value === "aal1" || value === "aal2" ? value : null;
}

// --- Mode -------------------------------------------------------------------------------------

export type MfaMode = "off" | "enrolled" | "required";

/**
 * off       nobody is challenged (today's behaviour)
 * enrolled  users who HAVE a verified factor must use it; others are unaffected
 * required  everybody needs a verified factor and an aal2 session
 *
 * Unset or empty means "off" (the current behaviour until the rollout). Any other unknown value
 * means "required": a typo in a security setting must not silently switch protection off.
 */
export function parseMode(value: unknown): MfaMode {
  if (value === undefined || value === null || value === "") return "off";
  if (value === "off" || value === "enrolled" || value === "required") return value;
  return "required";
}

// --- Access decision --------------------------------------------------------------------------

export type MfaDecision =
  | "allow" //     proceed
  | "challenge" // has a factor but this session is only aal1: verify it
  | "enrol" //     must set up a factor first
  | "deny"; //     cannot tell how the session was authenticated: refuse

export function decideMfaAccess(input: {
  mode: MfaMode;
  currentLevel: unknown;
  nextLevel: unknown;
  hasVerifiedFactor: boolean;
}): MfaDecision {
  if (input.mode === "off") return "allow";

  const current = parseAal(input.currentLevel);
  if (current === null) return "deny";

  // Either source is enough to say a second factor exists.
  const hasFactor = input.hasVerifiedFactor || parseAal(input.nextLevel) === "aal2";

  if (!hasFactor) return input.mode === "required" ? "enrol" : "allow";
  return current === "aal2" ? "allow" : "challenge";
}

// --- Recency of a verified MFA event ----------------------------------------------------------

export type AmrEntry = { method: string; timestamp: number };

/** Keeps only well-formed `{ method, timestamp }` entries. String-only amr (RFC 8176) has no timestamps. */
export function parseAmr(value: unknown): AmrEntry[] {
  if (!Array.isArray(value)) return [];
  const out: AmrEntry[] = [];
  for (const e of value) {
    if (typeof e !== "object" || e === null) continue;
    const { method, timestamp } = e as { method?: unknown; timestamp?: unknown };
    if (typeof method === "string" && typeof timestamp === "number" && Number.isFinite(timestamp) && timestamp > 0) {
      out.push({ method, timestamp });
    }
  }
  return out;
}

const TOTP_METHODS = new Set(["totp", "mfa/totp"]);

export type Recency = "fresh" | "stale" | "missing";

/**
 * How recently did the user pass a TOTP challenge? `now` and timestamps are Unix SECONDS.
 * "missing" covers: no entry, malformed entries, string-only amr, and timestamps in the future
 * beyond `skewSeconds` (a clock we cannot trust proves nothing).
 */
export function assessMfaRecency(input: { amr: unknown; now: number; maxAgeSeconds: number; skewSeconds?: number }): Recency {
  const skew = input.skewSeconds ?? 60;
  if (!Number.isFinite(input.now) || !(input.maxAgeSeconds > 0)) return "missing";

  const usable = parseAmr(input.amr).filter((e) => TOTP_METHODS.has(e.method) && e.timestamp <= input.now + skew);
  if (usable.length === 0) return "missing";

  const newest = Math.max(...usable.map((e) => e.timestamp));
  return input.now - newest <= input.maxAgeSeconds ? "fresh" : "stale";
}

export type StepUpDecision = "ok" | "reverify" | "enrol" | "deny";

/** For sensitive actions: an aal2 session AND a recent TOTP verification. */
export function decideStepUp(input: {
  currentLevel: unknown;
  amr: unknown;
  hasVerifiedFactor: boolean;
  now: number;
  maxAgeSeconds: number;
}): StepUpDecision {
  const current = parseAal(input.currentLevel);
  if (current === null) return "deny";
  if (!input.hasVerifiedFactor) return "enrol";
  if (current !== "aal2") return "reverify";
  return assessMfaRecency({ amr: input.amr, now: input.now, maxAgeSeconds: input.maxAgeSeconds }) === "fresh" ? "ok" : "reverify";
}

// --- Redirect target --------------------------------------------------------------------------

const AUTH_PAGES = ["/admin/login", "/admin/mfa"];

/**
 * Where to go after verifying. Only same-site /admin paths are accepted (no open redirect), and
 * never the login or challenge pages themselves (no redirect loop). Anything else gives `fallback`.
 */
export function safeNext(value: unknown, fallback = "/admin/leads"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 300) return fallback;
  if (!value.startsWith("/admin") || value.startsWith("//") || value.includes("\\")) return fallback;
  // Control characters and backslashes are refused both as written and after percent-decoding.
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return fallback;
  }
  for (const s of [value, decoded]) {
    if (s.includes("\\") || [...s].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f)) return fallback;
  }
  let url: URL;
  try {
    url = new URL(value, "http://local.invalid");
  } catch {
    return fallback;
  }
  if (url.origin !== "http://local.invalid") return fallback;
  if (url.pathname !== "/admin" && !url.pathname.startsWith("/admin/")) return fallback;
  if (AUTH_PAGES.some((p) => url.pathname === p || url.pathname.startsWith(p + "/"))) return fallback;
  return url.pathname + url.search;
}
