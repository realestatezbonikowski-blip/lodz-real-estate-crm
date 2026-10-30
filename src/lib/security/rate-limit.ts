// Best-effort, in-memory fixed-window rate limiter for the public enquiry endpoint.
//
// Honest limits: on serverless hosting each instance has its own memory, so this only slows down
// bursts hitting one instance. The authoritative limits are in the database (submit_lead: the
// duplicate window and the hourly cap) plus Turnstile. Keys (derived from the client address) live
// only in process memory, are never logged or persisted, and expire with their window.

export type RateLimiter = {
  check(key: string, now?: number): { allowed: boolean; retryAfterSec: number };
};

export function createRateLimiter(opts: { windowMs: number; max: number; maxKeys: number }): RateLimiter {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return {
    check(key, now = Date.now()) {
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= now) {
        if (hits.size >= opts.maxKeys) {
          for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
          // Still full: evict the oldest entry so memory stays bounded under a flood.
          if (hits.size >= opts.maxKeys) {
            const oldest = hits.keys().next().value;
            if (oldest !== undefined) hits.delete(oldest);
          }
        }
        hits.set(key, { count: 1, resetAt: now + opts.windowMs });
        return { allowed: true, retryAfterSec: 0 };
      }
      entry.count += 1;
      if (entry.count > opts.max) {
        return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
      }
      return { allowed: true, retryAfterSec: 0 };
    },
  };
}
