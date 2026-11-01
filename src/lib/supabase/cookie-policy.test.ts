// Verifies the auth-cookie policy against the REAL @supabase/ssr client (not a mock of it): a fake
// auth server answers sign-in/sign-out, an in-memory jar plays the role of Next's cookie store, and
// the adapter below is the same three lines used in server.ts and proxy.ts. No network, no secrets.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server.js"; // explicit entry: plain Node ESM has no "exports" map for "next/server"
import { AUTH_COOKIE_MAX_AGE_SECONDS, authCookieOptions, withAuthCookiePolicy } from "./cookie-policy.ts";

const b64u = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const fakeJwt = () => `${b64u({ alg: "HS256", typ: "JWT" })}.${b64u({ sub: "11111111-1111-4111-8111-111111111111", exp: Math.floor(Date.now() / 1000) + 3600, role: "authenticated", aud: "authenticated" })}.sig`;

const calls = { refresh: 0 };

function fakeAuthServer(): typeof fetch {
  return async (input) => {
    const url = String(input);
    if (url.includes("grant_type=refresh_token")) calls.refresh++;
    if (url.includes("/auth/v1/user")) {
      return new Response(JSON.stringify({ id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", role: "authenticated", email: "owner@example.test", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/auth/v1/token")) {
      return new Response(JSON.stringify({
        access_token: fakeJwt(), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r-fake",
        user: { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", role: "authenticated", email: "owner@example.test", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(null, { status: 204 }); // logout
  };
}

type Written = { name: string; value: string; options: Record<string, unknown> };

function harness(opts: { applyPolicy: boolean; production: boolean }) {
  const jar = new Map<string, string>();
  const writes: Written[] = [];
  // A fresh client per request over the same cookie jar, exactly like the app does.
  const fresh = () =>
    createServerClient("https://example.test", "sb_publishable_fake", {
      cookieOptions: opts.applyPolicy ? authCookieOptions(opts.production) : undefined,
      global: { fetch: fakeAuthServer() },
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (list) => {
          for (const { name, value, options } of list) {
            const final = opts.applyPolicy ? withAuthCookiePolicy(options, opts.production) : options;
            writes.push({ name, value, options: final });
            if (final.maxAge === 0 || value === "") jar.delete(name);
            else jar.set(name, value);
          }
        },
      },
    });
  return { client: fresh(), fresh, jar, writes };
}

async function signIn(h: ReturnType<typeof harness>) {
  const { error } = await h.client.auth.signInWithPassword({ email: "owner@example.test", password: "not-a-real-password" });
  assert.equal(error, null);
  for (let i = 0; i < 20 && h.writes.length === 0; i++) await new Promise((r) => setTimeout(r, 10));
}

describe("auth cookie policy (real @supabase/ssr)", () => {
  test("library limitation, pinned: it forces a 400-day maxAge on cookies it sets and honours the other options", async () => {
    const h = harness({ applyPolicy: false, production: true });
    // Even if we ask for a custom lifetime through cookieOptions, the library overrides it:
    const withCustom = createServerClient("https://example.test", "sb_publishable_fake", {
      cookieOptions: { maxAge: 60, httpOnly: true, secure: true, sameSite: "lax" },
      global: { fetch: fakeAuthServer() },
      cookies: { getAll: () => [], setAll: (list) => { for (const c of list) h.writes.push({ name: c.name, value: c.value, options: c.options }); } },
    });
    await withCustom.auth.signInWithPassword({ email: "owner@example.test", password: "x" });
    for (let i = 0; i < 20 && h.writes.length === 0; i++) await new Promise((r) => setTimeout(r, 10));
    assert.ok(h.writes.length > 0, "the library should write session cookies after sign-in");
    for (const w of h.writes) {
      assert.equal(w.options.httpOnly, true, "httpOnly from cookieOptions is honoured");
      assert.equal(w.options.secure, true, "secure from cookieOptions is honoured");
      assert.equal(w.options.sameSite, "lax", "sameSite from cookieOptions is honoured");
      assert.equal(w.options.maxAge, 400 * 24 * 60 * 60, "maxAge from cookieOptions is IGNORED (400 days). If this fails, the library now honours maxAge: remove the override in cookie-policy.ts");
    }
  });

  test("after sign-in every session cookie is HttpOnly, SameSite=Lax, Secure in production, and 7 days", async () => {
    const h = harness({ applyPolicy: true, production: true });
    await signIn(h);
    assert.ok(h.writes.length > 0);
    for (const w of h.writes) {
      assert.match(w.name, /^sb-.*-auth-token/);
      assert.equal(w.options.httpOnly, true);
      assert.equal(w.options.secure, true);
      assert.equal(w.options.sameSite, "lax");
      assert.equal(w.options.path, "/");
      assert.equal(w.options.maxAge, AUTH_COOKIE_MAX_AGE_SECONDS);
    }
    assert.ok(h.jar.size > 0, "the session is stored (a cookie jar entry exists)");
  });

  test("local development stays on plain http: secure is false outside production, the rest is unchanged", async () => {
    const h = harness({ applyPolicy: true, production: false });
    await signIn(h);
    for (const w of h.writes) {
      assert.equal(w.options.secure, false);
      assert.equal(w.options.httpOnly, true);
      assert.equal(w.options.sameSite, "lax");
    }
  });

  test("sign-out still deletes the cookies: maxAge 0 is preserved, with matching attributes", async () => {
    const h = harness({ applyPolicy: true, production: true });
    await signIn(h);
    const before = h.writes.length;
    await h.client.auth.signOut();
    for (let i = 0; i < 20 && h.writes.length === before; i++) await new Promise((r) => setTimeout(r, 10));
    const removals = h.writes.slice(before);
    assert.ok(removals.length > 0, "sign-out must write deletions");
    for (const w of removals) {
      assert.equal(w.options.maxAge, 0, "a deletion must stay a deletion");
      assert.equal(w.value, "");
      assert.equal(w.options.httpOnly, true);
      assert.equal(w.options.path, "/");
    }
    assert.equal(h.jar.size, 0, "no session cookie remains");
  });

  test("session refresh still works with HttpOnly: an expired session is refreshed server-side and rewritten with the policy", async () => {
    const h = harness({ applyPolicy: true, production: true });
    await signIn(h);
    const [name, original] = [...h.jar][0]!;
    // Age the stored session so the library must refresh it (what the proxy triggers via getUser()).
    const session = JSON.parse(Buffer.from(original.replace(/^base64-/, ""), "base64url").toString());
    session.expires_at = Math.floor(Date.now() / 1000) - 60;
    const aged = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
    h.jar.set(name, aged);
    h.writes.length = 0;
    calls.refresh = 0;

    const { data, error } = await h.fresh().auth.getUser(); // a new request, a new client
    for (let i = 0; i < 20 && h.writes.length === 0; i++) await new Promise((r) => setTimeout(r, 10));

    assert.equal(error, null);
    assert.equal(data.user?.email, "owner@example.test");
    assert.equal(calls.refresh, 1, "exactly one refresh-token grant is made");
    assert.ok(h.writes.length > 0, "the refreshed session is written back to the cookie");
    for (const w of h.writes) {
      assert.notEqual(w.value, aged);
      assert.deepEqual([w.options.httpOnly, w.options.secure, w.options.sameSite, w.options.maxAge], [true, true, "lax", AUTH_COOKIE_MAX_AGE_SECONDS]);
    }
  });

  test("the lifetime is shorter than before, longer than the access token, and a sliding window of days", () => {
    assert.ok(AUTH_COOKIE_MAX_AGE_SECONDS < 400 * 24 * 60 * 60);
    assert.ok(AUTH_COOKIE_MAX_AGE_SECONDS > 24 * 60 * 60, "must comfortably exceed the 1-hour access token so refresh keeps working");
    assert.ok(AUTH_COOKIE_MAX_AGE_SECONDS <= 30 * 24 * 60 * 60);
  });

  test("policy overrides are not defeatable by incoming options", () => {
    const o = withAuthCookiePolicy({ httpOnly: false, secure: false, sameSite: "none" as const, maxAge: 99_999_999, domain: "example.test" }, true);
    assert.deepEqual([o.httpOnly, o.secure, o.sameSite, o.maxAge], [true, true, "lax", AUTH_COOKIE_MAX_AGE_SECONDS]);
  });
});

describe("Next.js serialisation (the proxy path)", () => {
  test("NextResponse emits the expected Set-Cookie attributes, and a deletion expires immediately", () => {
    const res = NextResponse.next();
    res.cookies.set("sb-x-auth-token", "v", withAuthCookiePolicy({ maxAge: 400 * 86400, httpOnly: false }, true));
    res.cookies.set("sb-y-auth-token", "", withAuthCookiePolicy({ maxAge: 0 }, true));
    const [set, del] = res.headers.getSetCookie();
    for (const h of [set!, del!]) {
      assert.match(h, /HttpOnly/i);
      assert.match(h, /Secure/i);
      assert.match(h, /SameSite=lax/i);
      assert.match(h, /Path=\//);
    }
    assert.match(set!, /Max-Age=604800/);
    assert.match(del!, /Max-Age=0/);
  });
  test("in development the same cookie has no Secure flag so plain http://localhost keeps working", () => {
    const res = NextResponse.next();
    res.cookies.set("sb-x-auth-token", "v", withAuthCookiePolicy({}, false));
    const h = res.headers.getSetCookie()[0]!;
    assert.match(h, /HttpOnly/i);
    assert.doesNotMatch(h, /Secure/i);
  });
});

describe("wiring (structural)", () => {
  test("both the server client and the proxy pass cookieOptions and apply the policy in setAll", () => {
    for (const f of ["src/lib/supabase/server.ts", "src/proxy.ts"]) {
      const src = readFileSync(f, "utf8");
      assert.match(src, /cookieOptions:\s*authCookieOptions\(\)/, `${f} must pass cookieOptions`);
      assert.match(src, /withAuthCookiePolicy\(options\)/, `${f} must apply the policy where it writes cookies`);
    }
  });
  test("no other code creates a Supabase server client or writes auth cookies", () => {
    // createServerClient may only appear in the two audited files.
    const hits = ["src/features/crm/actions.ts", "src/features/crm/auth.ts", "src/app/admin/login/page.tsx"].filter((f) => /createServerClient\(/.test(readFileSync(f, "utf8")));
    assert.deepEqual(hits, []);
  });
});
