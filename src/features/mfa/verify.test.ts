import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createLoginGuard } from "../../lib/security/login-guard.ts";
import { attemptMfaVerify, classifyMfaError, MFA_GUARD_CONFIG, normaliseCode, type VerifyOutcome } from "./verify.ts";

const MIN = 60_000;
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

function setup(right = "123456") {
  const guard = createLoginGuard(MFA_GUARD_CONFIG);
  const seen: string[] = [];
  let t = 0;
  const run = (input: { userId: string; code: unknown; clientKey?: string }, outcomeOverride?: VerifyOutcome) =>
    attemptMfaVerify(
      { guard, now: () => t, verify: async (code) => (seen.push(code), outcomeOverride ?? (code === right ? "ok" : "invalid")) },
      input,
    );
  return { run, seen, at: (ms: number) => { t = ms; } };
}

describe("normaliseCode", () => {
  test("accepts six digits with optional spaces or hyphens", () => {
    for (const ok of ["123456", "123 456", "123-456", " 123456 ", "000000"]) assert.match(normaliseCode(ok) ?? "", /^\d{6}$/, ok);
    assert.equal(normaliseCode("123 456"), "123456");
  });
  test("rejects everything else", () => {
    for (const bad of ["", "12345", "1234567", "12345a", "abcdef", "12.456", "１２３４５６", null, undefined, 123456, {}, ["123456"]]) assert.equal(normaliseCode(bad), null, JSON.stringify(bad));
  });
});

describe("attemptMfaVerify", () => {
  test("a correct code verifies; a wrong code is just 'invalid'", async () => {
    const s = setup();
    assert.equal(await s.run({ userId: A, code: "123456" }), "ok");
    assert.equal(await s.run({ userId: A, code: "654321" }), "invalid");
  });

  test("the code is normalised before it reaches the auth server", async () => {
    const s = setup();
    await s.run({ userId: A, code: "123 456" });
    assert.deepEqual(s.seen, ["123456"]);
  });

  test("malformed codes never reach the auth server but still cost an attempt", async () => {
    const s = setup();
    const out = [];
    for (let i = 0; i < 6; i++) out.push(await s.run({ userId: A, code: "abc" }));
    assert.deepEqual(out, ["invalid", "invalid", "invalid", "invalid", "invalid", "rate"]);
    assert.equal(s.seen.length, 0);
  });

  test("verification failures: 5 wrong codes per account, then blocked WITHOUT contacting the auth server", async () => {
    const s = setup();
    const out = [];
    for (let i = 0; i < 8; i++) out.push(await s.run({ userId: A, code: String(100000 + i) }));
    assert.deepEqual(out, ["invalid", "invalid", "invalid", "invalid", "invalid", "rate", "rate", "rate"]);
    assert.equal(s.seen.length, 5);
  });

  test("the CORRECT code is refused while blocked (a block cannot be bypassed by guessing right)", async () => {
    const s = setup();
    for (let i = 0; i < 5; i++) await s.run({ userId: A, code: "000000" });
    assert.equal(await s.run({ userId: A, code: "123456" }), "rate");
  });

  test("recovery: the account can verify again when the window ends", async () => {
    const s = setup();
    for (let i = 0; i < 5; i++) await s.run({ userId: A, code: "000000" });
    assert.equal(await s.run({ userId: A, code: "123456" }), "rate");
    s.at(15 * MIN);
    assert.equal(await s.run({ userId: A, code: "123456" }), "ok");
  });

  test("isolation between accounts: one user's failures never block another", async () => {
    const s = setup();
    for (let i = 0; i < 5; i++) await s.run({ userId: A, code: "000000", clientKey: `ip4:9.9.9.${i}` });
    assert.equal(await s.run({ userId: A, code: "123456", clientKey: "ip4:8.8.8.8" }), "rate", "account A is blocked from any client");
    assert.equal(await s.run({ userId: B, code: "123456", clientKey: "ip4:8.8.8.8" }), "ok", "account B is unaffected");
  });

  test("isolation between clients: one address's failures never block another address", async () => {
    const s = setup();
    for (let i = 0; i < 10; i++) await s.run({ userId: `00000000-0000-4000-8000-0000000000${String(i).padStart(2, "0")}`, code: "000000", clientKey: "ip4:6.6.6.6" });
    assert.equal(await s.run({ userId: A, code: "123456", clientKey: "ip4:6.6.6.6" }), "rate");
    assert.equal(await s.run({ userId: A, code: "123456", clientKey: "ip4:203.0.113.7" }), "ok");
  });

  test("with no trusted client address only the account is limited (no shared bucket)", async () => {
    const s = setup();
    for (let i = 0; i < 5; i++) await s.run({ userId: A, code: "000000" });
    assert.equal(await s.run({ userId: A, code: "123456" }), "rate");
    assert.equal(await s.run({ userId: B, code: "123456" }), "ok");
  });

  test("successful verifications do not build towards a block", async () => {
    const s = setup();
    for (let i = 0; i < 30; i++) assert.equal(await s.run({ userId: A, code: "123456", clientKey: "ip4:1.1.1.1" }), "ok");
  });

  test("an auth-server outage is reported as unavailable and not counted", async () => {
    const s = setup();
    for (let i = 0; i < 12; i++) assert.equal(await s.run({ userId: A, code: "123456" }, "unavailable"), "unavailable");
    assert.equal(await s.run({ userId: A, code: "123456" }), "ok");
    const guard = createLoginGuard(MFA_GUARD_CONFIG);
    assert.equal(await attemptMfaVerify({ guard, verify: async () => { throw new Error("boom"); } }, { userId: A, code: "123456" }), "unavailable");
  });

  test("the account key is derived from the user id, not from anything the client chooses", async () => {
    const s = setup();
    for (let i = 0; i < 5; i++) await s.run({ userId: A, code: "000000", clientKey: `ip4:10.0.0.${i}` });
    assert.equal(await s.run({ userId: A, code: "123456", clientKey: "ip4:10.9.9.9" }), "rate");
  });
});

describe("classifyMfaError", () => {
  test("never exposes the server's message", () => {
    assert.equal(classifyMfaError(null), "ok");
    assert.equal(classifyMfaError({ status: 400, code: "mfa_verification_failed" }), "invalid");
    assert.equal(classifyMfaError({ status: 400, code: "mfa_challenge_expired" }), "invalid");
    assert.equal(classifyMfaError({ status: 422, code: "mfa_factor_not_found" }), "invalid");
    assert.equal(classifyMfaError({ status: 429, code: "over_request_rate_limit" }), "rate");
    assert.equal(classifyMfaError({ status: 503 }), "unavailable");
    assert.equal(classifyMfaError({ name: "AuthRetryableFetchError", status: 0 }), "unavailable");
  });
});
