// loadMfaState against the REAL @supabase/ssr + auth-js client, with a fake auth server that lets the
// tests choose the user's factors and the token's claims. No network, no secrets.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createServerClient } from "@supabase/ssr";
import { loadMfaState } from "./state.ts";

const UID = "11111111-1111-4111-8111-111111111111";
const b64u = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const nowS = () => Math.floor(Date.now() / 1000);

type Scenario = {
  claims?: Record<string, unknown>;
  factors?: { id: string; factor_type: string; status: string; friendly_name?: string }[];
  rejectUser?: boolean;
  noSession?: boolean;
};

function client(s: Scenario) {
  const claims = { sub: UID, role: "authenticated", aud: "authenticated", exp: nowS() + 3600, iat: nowS(), session_id: "s1", aal: "aal1", amr: [{ method: "password", timestamp: nowS() }], ...s.claims };
  const access = `${b64u({ alg: "HS256", typ: "JWT" })}.${b64u(claims)}.sig`; // symmetric: getClaims() falls back to the server check
  const user = { id: UID, aud: "authenticated", role: "authenticated", email: "owner@example.test", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(), factors: s.factors ?? [] };
  const session = { access_token: access, refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: nowS() + 3600, user };
  const jar = new Map<string, string>();
  if (!s.noSession) jar.set("sb-example-auth-token", "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url"));

  const fakeFetch: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("/auth/v1/user")) {
      return s.rejectUser
        ? new Response(JSON.stringify({ code: 401, error_code: "bad_jwt", msg: "invalid JWT" }), { status: 401, headers: { "content-type": "application/json" } })
        : new Response(JSON.stringify(user), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response("{}", { status: 404 });
  };
  return createServerClient("https://example.test", "sb_publishable_fake", {
    global: { fetch: fakeFetch },
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: () => {} },
  });
}

const totp = (status: string, id = "f1") => ({ id, factor_type: "totp", status, friendly_name: "Telefon" });

describe("loadMfaState: server-validated MFA state", () => {
  test("no session at all", async () => {
    assert.deepEqual(await loadMfaState(client({ noSession: true })), { signedIn: false });
  });

  test("a token the auth server rejects is treated as signed out", async () => {
    assert.deepEqual(await loadMfaState(client({ rejectUser: true, factors: [totp("verified")] })), { signedIn: false });
  });

  test("password-only session with a verified factor: aal1, factor reported, next step is a challenge", async () => {
    const st = await loadMfaState(client({ factors: [totp("verified")] }));
    assert.ok(st.signedIn);
    if (!st.signedIn) return;
    assert.equal(st.currentLevel, "aal1");
    assert.equal(st.hasVerifiedFactor, true);
    assert.equal(st.verifiedTotp.length, 1);
    assert.equal(st.factors[0]?.friendlyName, "Telefon");
  });

  test("aal2 session: level and the TOTP event timestamp come from the verified claims", async () => {
    const ts = nowS() - 20;
    const st = await loadMfaState(client({ claims: { aal: "aal2", amr: [{ method: "totp", timestamp: ts }, { method: "password", timestamp: ts - 5 }] }, factors: [totp("verified")] }));
    assert.ok(st.signedIn);
    if (!st.signedIn) return;
    assert.equal(st.currentLevel, "aal2");
    assert.deepEqual(st.amr.find((e) => e.method === "totp"), { method: "totp", timestamp: ts });
  });

  test("an unverified (pending) factor does not count as enrolled", async () => {
    const st = await loadMfaState(client({ factors: [totp("unverified")] }));
    assert.ok(st.signedIn);
    if (!st.signedIn) return;
    assert.equal(st.hasVerifiedFactor, false);
    assert.equal(st.verifiedTotp.length, 0);
    assert.equal(st.factors.length, 1);
  });

  test("no factors: nothing enrolled, level still read", async () => {
    const st = await loadMfaState(client({}));
    assert.ok(st.signedIn);
    if (!st.signedIn) return;
    assert.deepEqual([st.hasVerifiedFactor, st.currentLevel, st.factors.length], [false, "aal1", 0]);
  });

  test("a malformed or unknown aal claim is 'unknown' (null), never silently aal1", async () => {
    for (const bad of ["AAL2", "aal3", "", 2, null]) {
      const st = await loadMfaState(client({ claims: { aal: bad } }));
      assert.ok(st.signedIn);
      if (st.signedIn) assert.equal(st.currentLevel, null, JSON.stringify(bad));
    }
  });

  test("claims that belong to a different user than the one the server validated are discarded", async () => {
    const st = await loadMfaState(client({ claims: { sub: "99999999-9999-4999-8999-999999999999", aal: "aal2", amr: [{ method: "totp", timestamp: nowS() }] }, factors: [totp("verified")] }));
    assert.ok(st.signedIn);
    if (!st.signedIn) return;
    assert.equal(st.currentLevel, null);
    assert.deepEqual(st.amr, []);
  });

  test("malformed factor entries are skipped, valid ones kept", async () => {
    const st = await loadMfaState(client({ factors: [totp("verified", "ok-1"), { id: "bad", factor_type: "totp", status: "weird" }, totp("unverified", "ok-2")] }));
    assert.ok(st.signedIn);
    if (st.signedIn) assert.deepEqual(st.factors.map((f) => f.id), ["ok-1", "ok-2"]);
  });
});

// The exact sequence removeFactor() relies on: verify a code, then re-read the state from the SAME
// client and expect an aal2 session with a fresh TOTP event (no new request, no new client).
describe("re-reading the state after a successful verification (same client)", () => {
  function upgradingClient() {
    const jar = new Map<string, string>();
    const factors = [{ id: "f1", factor_type: "totp", status: "verified", friendly_name: "Telefon", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }];
    const token = (aal: string, totpAt?: number) => {
      const amr: unknown[] = [{ method: "password", timestamp: nowS() - 100 }];
      if (totpAt) amr.unshift({ method: "totp", timestamp: totpAt });
      const claims = { sub: UID, role: "authenticated", aud: "authenticated", exp: nowS() + 3600, iat: nowS(), session_id: "s1", aal, amr };
      return `${b64u({ alg: "HS256", typ: "JWT" })}.${b64u(claims)}.sig`;
    };
    const userObj = () => ({ id: UID, aud: "authenticated", role: "authenticated", email: "owner@example.test", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(), factors });
    const sess = (aal: string, totpAt?: number) => ({ access_token: token(aal, totpAt), refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: nowS() + 3600, user: userObj() });
    jar.set("sb-example-auth-token", "base64-" + Buffer.from(JSON.stringify(sess("aal1"))).toString("base64url"));

    const fakeFetch: typeof fetch = async (input) => {
      const url = String(input);
      const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
      if (url.includes("/challenge")) return json({ id: "c1", type: "totp", expires_at: nowS() + 300 });
      if (url.includes("/verify")) return json(sess("aal2", nowS()));
      if (url.includes("/auth/v1/user")) return json(userObj());
      return json({}, 404);
    };
    const client = createServerClient("https://example.test", "sb_publishable_fake", {
      global: { fetch: fakeFetch },
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (list) => {
          for (const { name, value, options } of list) {
            if (options.maxAge === 0) jar.delete(name);
            else jar.set(name, value);
          }
        },
      },
    });
    return client;
  }

  test("after challengeAndVerify the same client reports aal2 and a fresh TOTP event", async () => {
    const client = upgradingClient();
    const before = await loadMfaState(client);
    assert.ok(before.signedIn);
    if (before.signedIn) assert.equal(before.currentLevel, "aal1");

    const { error } = await client.auth.mfa.challengeAndVerify({ factorId: "f1", code: "123456" });
    assert.equal(error, null);

    const after = await loadMfaState(client);
    assert.ok(after.signedIn);
    if (!after.signedIn) return;
    assert.equal(after.currentLevel, "aal2", "the upgraded session must be visible to the same client");
    const { assessMfaRecency } = await import("./policy.ts");
    assert.equal(assessMfaRecency({ amr: after.amr, now: nowS(), maxAgeSeconds: 300 }), "fresh");
  });
});
