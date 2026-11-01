// One place that decides how the Supabase auth cookies are written. Used by BOTH the server client
// (src/lib/supabase/server.ts) and the proxy (src/proxy.ts). Pure module: no Next.js or Supabase
// imports, so it is unit-tested directly with node --test.
//
// Why an explicit override and not just `cookieOptions`:
//   @supabase/ssr 0.12.7 spreads `cookieOptions` into the options it passes to `setAll` (so
//   httpOnly / secure / sameSite ARE honoured), but for cookies it SETS it then forces
//   `maxAge` back to its own default of 400 days, so a `maxAge` given in `cookieOptions` is
//   ignored. We therefore apply the policy again where we write the cookie (`setAll`).
//   `cookie-policy.test.ts` pins this behaviour: if a future version honours `maxAge`, that test
//   fails and this override can be removed.
//
// Settings:
//   httpOnly  true   The app has no browser Supabase client, so no script ever needs to read the
//                    session; this keeps tokens away from injected scripts.
//   secure    true in production only (HTTPS). Local development runs on plain http://localhost.
//   sameSite  lax    Blocks cross-site POSTs carrying the cookie while still allowing normal links.
//   maxAge    7 days Sliding inactivity window, see below.
//
// Why 7 days: the cookie holds the access token (valid ~1 hour) and the refresh token. The proxy
// validates and refreshes the session on every /admin request, and each refresh changes the cookie
// value, which rewrites it with a fresh 7-day expiry. So the lifetime behaves as an inactivity
// timeout: use the CRM at least once a week and you stay signed in; stay away longer and the cookie
// expires. It must be (and is, by far) longer than the access-token lifetime, or refreshing would
// break. It is much shorter than the previous 400 days. The refresh token itself is also limited
// server-side by Supabase's own session settings (not configurable on every plan).
export const AUTH_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Options handed to createServerClient({ cookieOptions }); the library honours all of these. */
export function authCookieOptions(production: boolean = isProduction()) {
  return { httpOnly: true, secure: production, sameSite: "lax" as const, path: "/" };
}

/**
 * Applies the policy to the options the library passes to `setAll` for each cookie.
 * Deletions (the library marks them with maxAge 0) stay deletions, with the same attributes so the
 * browser matches and removes the original cookie.
 */
type Policy = { httpOnly: boolean; secure: boolean; sameSite: "lax"; path: string; maxAge: number };

export function withAuthCookiePolicy<T extends { maxAge?: number }>(
  options: T,
  production: boolean = isProduction(),
): Omit<T, keyof Policy> & Policy {
  const isDeletion = options.maxAge === 0;
  return { ...options, ...authCookieOptions(production), maxAge: isDeletion ? 0 : AUTH_COOKIE_MAX_AGE_SECONDS };
}
