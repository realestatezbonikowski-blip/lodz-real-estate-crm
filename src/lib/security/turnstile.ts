// Server-side Cloudflare Turnstile verification. The secret key never leaves the server.
// Fails closed: any problem other than an explicit "success: true" is not a pass.

export type TurnstileResult = "ok" | "failed" | "error";
export type TurnstileVerifier = (token: string) => Promise<TurnstileResult>;

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function createTurnstileVerifier(
  secret: string | undefined,
  fetchImpl: typeof fetch = fetch,
): TurnstileVerifier {
  return async (token) => {
    if (!secret) return "error"; // not configured: never pass
    try {
      const res = await fetchImpl(VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        // The client address is deliberately not sent (data minimisation).
        body: new URLSearchParams({ secret, response: token }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return "error";
      const data = (await res.json()) as { success?: unknown };
      return data.success === true ? "ok" : "failed";
    } catch {
      return "error";
    }
  };
}
