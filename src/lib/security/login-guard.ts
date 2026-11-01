// Brute-force guard for the staff login. Pure and in-memory, so it is exact within ONE server
// process and approximate across instances (see "Limits" below). No shared global bucket exists:
// a client or an account is only ever limited by its own counters.
//
// How it works
//   * Every attempt is COUNTED UP FRONT (`begin`), before the password is checked, so a burst of
//     parallel requests cannot all slip under the limit while earlier ones are still in flight.
//   * A successful login (or an outage that is not the user's fault) gives its attempt back
//     (`release`), so legitimate use never accumulates towards a block.
//   * Two independent scopes, each a fixed window that starts at its first counted attempt:
//       client   (only when a TRUSTED client address is known, see client-ip.ts)  default 5 / 15 min
//       account  (keyed by a keyed hash of the e-mail, never the raw address)     default 10 / 15 min
//     If either scope is full the attempt is refused WITHOUT being counted anywhere else and the
//     auth server is not contacted at all.
//   * Blocks expire by themselves when the window ends, so a legitimate user always recovers.
//   * Unknown and existing accounts are treated identically (the key is derived from whatever was
//     typed), so the limiter cannot be used to find out which accounts exist.
//
// Trade-off, stated plainly: the per-account scope means someone who knows the owner's e-mail can
// make the owner wait up to one window (15 min) by failing 10 times. That is a nuisance, not a
// breach, and it only ever affects that one account. The alternative (no per-account limit) would
// let a distributed attacker guess one password without bound.
//
// Limits: a restart clears all counters, and with N instances the effective limit is up to N times
// higher. Real protection in production also needs an edge/WAF rate limit or a shared store (see
// docs/content-needed.md, section 4). Do not treat this module alone as sufficient.
import { createHmac, randomBytes } from "node:crypto";

export type Scope = { max: number; windowMs: number };
export type GuardConfig = { client: Scope; account: Scope; maxKeys: number };

export const DEFAULT_GUARD_CONFIG: GuardConfig = {
  client: { max: 5, windowMs: 15 * 60_000 },
  account: { max: 10, windowMs: 15 * 60_000 },
  maxKeys: 5000,
};

type Entry = { count: number; resetAt: number };
export type Ticket = { keys: string[] };
export type BeginResult = { allowed: true; ticket: Ticket } | { allowed: false; retryAfterSec: number };

export function createLoginGuard(config: GuardConfig = DEFAULT_GUARD_CONFIG) {
  const entries = new Map<string, Entry>();
  const secret = randomBytes(32); // per process: counters never hold raw e-mail addresses

  function live(key: string, now: number): Entry | undefined {
    const e = entries.get(key);
    if (e && e.resetAt <= now) {
      entries.delete(key);
      return undefined;
    }
    return e;
  }

  function make(now: number, key: string, scope: Scope): Entry {
    if (entries.size >= config.maxKeys) {
      for (const [k, v] of entries) if (v.resetAt <= now) entries.delete(k);
      while (entries.size >= config.maxKeys) {
        const oldest = entries.keys().next().value; // bounded memory under a flood of distinct keys
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
    }
    const e = { count: 0, resetAt: now + scope.windowMs };
    entries.set(key, e);
    return e;
  }

  return {
    /** A keyed hash of the typed e-mail: same input, same key; the address itself is never stored. */
    accountKey(email: string): string {
      return "acct:" + createHmac("sha256", secret).update(email.trim().toLowerCase()).digest("hex").slice(0, 32);
    },

    begin(keys: { client?: string; account?: string }, now: number = Date.now()): BeginResult {
      const wanted: [string, Scope][] = [];
      if (keys.client) wanted.push([keys.client, config.client]);
      if (keys.account) wanted.push([keys.account, config.account]);

      // First decide, then count: a refused attempt must not be charged to the other scope.
      for (const [key, scope] of wanted) {
        const e = live(key, now);
        if (e && e.count >= scope.max) return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((e.resetAt - now) / 1000)) };
      }
      for (const [key, scope] of wanted) (live(key, now) ?? make(now, key, scope)).count++;
      return { allowed: true, ticket: { keys: wanted.map(([k]) => k) } };
    },

    /** Gives an attempt back: used after a successful login or an outage that is not the user's fault. */
    release(ticket: Ticket, now: number = Date.now()): void {
      for (const key of ticket.keys) {
        const e = live(key, now);
        if (e && e.count > 0) e.count--;
      }
    },

    size: () => entries.size,
  };
}

export type LoginGuard = ReturnType<typeof createLoginGuard>;
