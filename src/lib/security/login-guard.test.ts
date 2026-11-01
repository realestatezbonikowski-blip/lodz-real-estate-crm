import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createLoginGuard, type GuardConfig } from "./login-guard.ts";

const MIN = 60_000;
const cfg: GuardConfig = { client: { max: 3, windowMs: 15 * MIN }, account: { max: 5, windowMs: 15 * MIN }, maxKeys: 50 };

const attempts = (g: ReturnType<typeof createLoginGuard>, keys: { client?: string; account?: string }, n: number, now = 0) =>
  Array.from({ length: n }, () => g.begin(keys, now).allowed);

describe("login guard: repeated failures", () => {
  test("a client is blocked after its limit, with a retry time that counts down", () => {
    const g = createLoginGuard(cfg);
    assert.deepEqual(attempts(g, { client: "ip4:1.1.1.1" }, 3), [true, true, true]);
    const blocked = g.begin({ client: "ip4:1.1.1.1" }, 5 * MIN);
    assert.equal(blocked.allowed, false);
    if (!blocked.allowed) assert.equal(blocked.retryAfterSec, 10 * 60);
  });

  test("an account is blocked after its limit, whichever clients the attempts came from", () => {
    const g = createLoginGuard(cfg);
    const acct = g.accountKey("owner@example.test");
    for (let i = 0; i < 5; i++) assert.equal(g.begin({ client: `ip4:9.9.9.${i}`, account: acct }, 0).allowed, true);
    assert.equal(g.begin({ client: "ip4:8.8.8.8", account: acct }, 0).allowed, false, "a brand-new client is still refused for that account");
  });

  test("parallel bursts cannot overshoot: attempts are counted before the password is checked", () => {
    const g = createLoginGuard(cfg);
    const results = attempts(g, { client: "ip4:2.2.2.2" }, 50); // 50 'simultaneous' requests, none finished yet
    assert.equal(results.filter(Boolean).length, 3);
  });
});

describe("login guard: recovery", () => {
  test("the block ends by itself when the window ends", () => {
    const g = createLoginGuard(cfg);
    attempts(g, { client: "ip4:1.1.1.1" }, 3, 0);
    assert.equal(g.begin({ client: "ip4:1.1.1.1" }, 15 * MIN - 1).allowed, false);
    assert.equal(g.begin({ client: "ip4:1.1.1.1" }, 15 * MIN).allowed, true, "allowed again exactly when the window ends");
    // and a fresh window starts counting again from zero
    assert.deepEqual(attempts(g, { client: "ip4:1.1.1.1" }, 2, 15 * MIN), [true, true]);
    assert.equal(g.begin({ client: "ip4:1.1.1.1" }, 15 * MIN).allowed, false);
  });

  test("a successful login gives its attempt back, so legitimate use never builds towards a block", () => {
    const g = createLoginGuard(cfg);
    for (let i = 0; i < 20; i++) {
      const r = g.begin({ client: "ip4:3.3.3.3", account: g.accountKey("a@example.test") }, 0);
      assert.equal(r.allowed, true, `login ${i + 1} must be allowed`);
      if (r.allowed) g.release(r.ticket, 0);
    }
  });

  test("failures still count after an interleaved success (success cannot be used to wash failures away)", () => {
    const g = createLoginGuard(cfg);
    const k = { client: "ip4:4.4.4.4" };
    g.begin(k, 0); g.begin(k, 0);                 // two failures
    const ok = g.begin(k, 0);                      // third attempt succeeds and is released
    assert.ok(ok.allowed);
    if (ok.allowed) g.release(ok.ticket, 0);
    assert.equal(g.begin(k, 0).allowed, true);     // third failure still allowed (count back to 3)
    assert.equal(g.begin(k, 0).allowed, false);    // the next one is not
  });
});

describe("login guard: isolation", () => {
  test("one client's failures never affect another client", () => {
    const g = createLoginGuard(cfg);
    attempts(g, { client: "ip4:1.1.1.1" }, 10);
    assert.equal(g.begin({ client: "ip4:1.1.1.1" }, 0).allowed, false);
    assert.equal(g.begin({ client: "ip4:2.2.2.2" }, 0).allowed, true);
  });

  test("one account's failures never affect another account (no global bucket)", () => {
    const g = createLoginGuard(cfg);
    const a = g.accountKey("a@example.test");
    const b = g.accountKey("b@example.test");
    attempts(g, { account: a }, 10);
    assert.equal(g.begin({ account: a }, 0).allowed, false);
    assert.equal(g.begin({ account: b }, 0).allowed, true);
  });

  test("no client key and no account key means nothing is limited (never a shared bucket)", () => {
    const g = createLoginGuard(cfg);
    for (let i = 0; i < 100; i++) assert.equal(g.begin({}, 0).allowed, true);
    assert.equal(g.size(), 0);
  });

  test("a refused attempt is not charged to the other scope", () => {
    const g = createLoginGuard(cfg);
    attempts(g, { client: "ip4:1.1.1.1" }, 3); // client full
    const acct = g.accountKey("owner@example.test");
    for (let i = 0; i < 10; i++) assert.equal(g.begin({ client: "ip4:1.1.1.1", account: acct }, 0).allowed, false);
    // the blocked client must not have burned the account's budget
    assert.equal(g.begin({ client: "ip4:7.7.7.7", account: acct }, 0).allowed, true);
  });
});

describe("login guard: account keys and memory", () => {
  test("account keys are stable, case-insensitive, never contain the address, and differ per process", () => {
    const g1 = createLoginGuard(cfg);
    const g2 = createLoginGuard(cfg);
    assert.equal(g1.accountKey("Owner@Example.test "), g1.accountKey("owner@example.test"));
    assert.notEqual(g1.accountKey("a@example.test"), g1.accountKey("b@example.test"));
    assert.ok(!g1.accountKey("owner@example.test").includes("owner"));
    assert.notEqual(g1.accountKey("a@example.test"), g2.accountKey("a@example.test"));
  });

  test("existing and non-existing accounts behave identically (the limiter reveals nothing)", () => {
    const g = createLoginGuard(cfg);
    const real = g.accountKey("owner@example.test");
    const ghost = g.accountKey("does-not-exist@example.test");
    assert.deepEqual(attempts(g, { account: real }, 7), attempts(g, { account: ghost }, 7));
  });

  test("memory stays bounded under a flood of distinct keys, and a flood cannot lock out a fresh client", () => {
    const g = createLoginGuard({ ...cfg, maxKeys: 20 });
    for (let i = 0; i < 1000; i++) g.begin({ client: `ip4:10.0.${i >> 8}.${i & 255}` }, 0);
    assert.ok(g.size() <= 20);
    assert.equal(g.begin({ client: "ip4:203.0.113.9" }, 0).allowed, true);
  });
});
