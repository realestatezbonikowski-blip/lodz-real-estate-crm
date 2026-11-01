import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createLoginGuard, type GuardConfig } from "../../lib/security/login-guard.ts";
import { attemptLogin, classifyAuthError, type AuthResult } from "./login.ts";

const MIN = 60_000;
const cfg: GuardConfig = { client: { max: 3, windowMs: 15 * MIN }, account: { max: 5, windowMs: 15 * MIN }, maxKeys: 100 };
const good = { email: "owner@example.test", password: "correct-horse" };

function setup(accept: (email: string, password: string) => AuthResult = (e, p) => (e === good.email && p === good.password ? "ok" : "invalid")) {
  const guard = createLoginGuard(cfg);
  let authCalls = 0;
  let t = 0;
  const run = (input: { email: string; password: string; clientKey?: string }) =>
    attemptLogin({ guard, now: () => t, authenticate: async (e, p) => (authCalls++, accept(e, p)) }, input);
  return { run, calls: () => authCalls, at: (ms: number) => { t = ms; } };
}

describe("attemptLogin", () => {
  test("correct credentials sign in", async () => {
    assert.equal(await setup().run({ ...good, clientKey: "ip4:1.1.1.1" }), "ok");
  });

  test("wrong password and unknown account give the SAME outcome (no account enumeration)", async () => {
    const s = setup();
    const wrongPassword = await s.run({ email: good.email, password: "nope", clientKey: "ip4:1.1.1.1" });
    const unknownAccount = await s.run({ email: "ghost@example.test", password: "nope", clientKey: "ip4:2.2.2.2" });
    assert.equal(wrongPassword, "invalid");
    assert.equal(unknownAccount, "invalid");
  });

  test("repeated failures from one client are refused, and the auth server is NOT contacted once blocked", async () => {
    const s = setup();
    const k = { clientKey: "ip4:1.1.1.1" };
    const results = [];
    for (let i = 0; i < 6; i++) results.push(await s.run({ email: good.email, password: "bad" + i, ...k }));
    assert.deepEqual(results, ["invalid", "invalid", "invalid", "rate", "rate", "rate"]);
    assert.equal(s.calls(), 3, "blocked attempts never reach Supabase Auth");
  });

  test("even the CORRECT password is refused while blocked (a block cannot be bypassed by guessing right)", async () => {
    const s = setup();
    for (let i = 0; i < 3; i++) await s.run({ email: good.email, password: "bad", clientKey: "ip4:1.1.1.1" });
    assert.equal(await s.run({ ...good, clientKey: "ip4:1.1.1.1" }), "rate");
  });

  test("recovery: after the window the same client can sign in again", async () => {
    const s = setup();
    for (let i = 0; i < 3; i++) await s.run({ email: good.email, password: "bad", clientKey: "ip4:1.1.1.1" });
    assert.equal(await s.run({ ...good, clientKey: "ip4:1.1.1.1" }), "rate");
    s.at(15 * MIN);
    assert.equal(await s.run({ ...good, clientKey: "ip4:1.1.1.1" }), "ok");
  });

  test("another client is not affected by someone else's failures", async () => {
    const s = setup();
    for (let i = 0; i < 5; i++) await s.run({ email: "ghost@example.test", password: "bad", clientKey: "ip4:6.6.6.6" });
    assert.equal(await s.run({ ...good, clientKey: "ip4:203.0.113.7" }), "ok");
  });

  test("without a trusted client address, only the account is limited: other accounts stay usable", async () => {
    const s = setup();
    for (let i = 0; i < 5; i++) await s.run({ email: "target@example.test", password: "bad" }); // no clientKey
    assert.equal(await s.run({ email: "target@example.test", password: "bad" }), "rate");
    assert.equal(await s.run(good), "ok", "there is no shared bucket that could lock everyone out");
  });

  test("distributed guessing against one account is capped regardless of source address", async () => {
    const s = setup();
    const out = [];
    for (let i = 0; i < 8; i++) out.push(await s.run({ email: good.email, password: "bad" + i, clientKey: `ip4:10.0.0.${i}` }));
    assert.equal(out.filter((o) => o === "invalid").length, 5);
    assert.equal(out.filter((o) => o === "rate").length, 3);
    assert.equal(s.calls(), 5);
  });

  test("successful logins do not accumulate towards a block", async () => {
    const s = setup();
    for (let i = 0; i < 15; i++) assert.equal(await s.run({ ...good, clientKey: "ip4:1.1.1.1" }), "ok");
  });

  test("an auth-server outage is not the user's fault: it is reported as unavailable and not counted", async () => {
    const s = setup(() => "unavailable");
    for (let i = 0; i < 10; i++) assert.equal(await s.run({ ...good, clientKey: "ip4:1.1.1.1" }), "unavailable");
    const throwing = createLoginGuard(cfg);
    const out = await attemptLogin({ guard: throwing, authenticate: async () => { throw new Error("boom"); } }, { ...good, clientKey: "ip4:1.1.1.1" });
    assert.equal(out, "unavailable");
  });

  test("malformed input is refused as invalid, still costs the client an attempt, and never reaches Supabase", async () => {
    const s = setup();
    const out = [];
    for (let i = 0; i < 4; i++) out.push(await s.run({ email: "not-an-email", password: "", clientKey: "ip4:1.1.1.1" }));
    assert.deepEqual(out, ["invalid", "invalid", "invalid", "rate"]);
    assert.equal(s.calls(), 0);
  });
});

describe("classifyAuthError", () => {
  test("maps Supabase errors without ever exposing their text", () => {
    assert.equal(classifyAuthError(null), "ok");
    assert.equal(classifyAuthError({ status: 400, code: "invalid_credentials" }), "invalid");
    assert.equal(classifyAuthError({ status: 400, code: "email_not_confirmed" }), "invalid");
    assert.equal(classifyAuthError({ status: 429, code: "over_request_rate_limit" }), "rate");
    assert.equal(classifyAuthError({ status: 500 }), "unavailable");
    assert.equal(classifyAuthError({ name: "AuthRetryableFetchError", status: 0 }), "unavailable");
  });
});
