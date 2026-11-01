import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { assessMfaRecency, decideMfaAccess, decideStepUp, parseAal, parseAmr, parseMode, safeNext, type MfaDecision, type MfaMode } from "./policy.ts";

describe("parseAal / parseMode: strict and fail-closed", () => {
  test("only exact aal1 / aal2 are levels", () => {
    assert.equal(parseAal("aal1"), "aal1");
    assert.equal(parseAal("aal2"), "aal2");
    for (const bad of [null, undefined, "", "AAL2", " aal2", "aal2 ", "aal3", "aal", 2, true, {}, [], ["aal2"]]) assert.equal(parseAal(bad), null, JSON.stringify(bad));
  });

  test("unset means off (today's behaviour); a typo means required, never silently off", () => {
    for (const unset of [undefined, null, ""]) assert.equal(parseMode(unset), "off");
    for (const ok of ["off", "enrolled", "required"] as const) assert.equal(parseMode(ok), ok);
    for (const typo of ["Required", "on", "true", "0", "disabled", " off", 1, false]) assert.equal(parseMode(typo), "required", JSON.stringify(typo));
  });
});

describe("decideMfaAccess: full table (mode x current x next x factor)", () => {
  // [mode, currentLevel, nextLevel, hasVerifiedFactor, expected]
  const table: [MfaMode, unknown, unknown, boolean, MfaDecision][] = [
    // off: today's behaviour, whatever the session looks like
    ["off", "aal1", "aal1", false, "allow"],
    ["off", "aal1", "aal2", true, "allow"],
    ["off", "aal2", "aal2", true, "allow"],
    ["off", null, null, false, "allow"],
    ["off", "garbage", undefined, true, "allow"],

    // enrolled: users WITHOUT a factor are not affected (no lock-out of the existing owner)
    ["enrolled", "aal1", "aal1", false, "allow"],
    ["enrolled", "aal1", null, false, "allow"],
    ["enrolled", "aal2", "aal2", false, "allow"],
    // enrolled: users WITH a factor must have used it
    ["enrolled", "aal1", "aal2", true, "challenge"],
    ["enrolled", "aal1", "aal1", true, "challenge"], // factor list says enrolled even if nextLevel disagrees
    ["enrolled", "aal1", "aal2", false, "challenge"], // nextLevel says enrolled even if the factor list is empty
    ["enrolled", "aal2", "aal2", true, "allow"],

    // required: everybody needs a factor and aal2
    ["required", "aal1", "aal1", false, "enrol"],
    ["required", "aal1", null, false, "enrol"],
    ["required", "aal2", "aal1", false, "enrol"], // factor removed during the session: enrol again
    ["required", "aal1", "aal2", true, "challenge"],
    ["required", "aal2", "aal2", true, "allow"],
    ["required", "aal2", "aal2", false, "allow"], // nextLevel aal2 implies an enrolled factor

    // unknown / malformed current level fails closed whenever MFA matters
    ["enrolled", null, "aal2", true, "deny"],
    ["enrolled", undefined, "aal1", false, "deny"],
    ["enrolled", "AAL2", "aal2", true, "deny"],
    ["required", "", "aal2", true, "deny"],
    ["required", 2, "aal2", true, "deny"],
    ["required", { aal: "aal2" }, "aal2", true, "deny"],
    ["required", "aal3", "aal2", true, "deny"],

    // unknown NEXT level is simply ignored (the factor list still decides)
    ["required", "aal1", "weird", false, "enrol"],
    ["required", "aal1", "weird", true, "challenge"],
    ["enrolled", "aal2", "weird", true, "allow"],
  ];

  for (const [mode, current, next, factor, expected] of table) {
    test(`${mode} | current=${JSON.stringify(current)} next=${JSON.stringify(next)} factor=${factor} -> ${expected}`, () => {
      assert.equal(decideMfaAccess({ mode, currentLevel: current, nextLevel: next, hasVerifiedFactor: factor }), expected);
    });
  }

  test("a session can never reach 'allow' in required mode with an unknown level", () => {
    for (const lvl of [null, undefined, "", "x", 1, "AAL2"]) {
      for (const next of ["aal1", "aal2", null]) for (const f of [true, false]) {
        assert.notEqual(decideMfaAccess({ mode: "required", currentLevel: lvl, nextLevel: next, hasVerifiedFactor: f }), "allow");
      }
    }
  });
});

describe("assessMfaRecency (timestamps are Unix seconds)", () => {
  const now = 1_800_000_000;
  const MAX = 300;
  const at = (ageSeconds: number, method = "totp") => [{ method, timestamp: now - ageSeconds }];

  test("fresh, stale and the exact boundary", () => {
    assert.equal(assessMfaRecency({ amr: at(0), now, maxAgeSeconds: MAX }), "fresh");
    assert.equal(assessMfaRecency({ amr: at(299), now, maxAgeSeconds: MAX }), "fresh");
    assert.equal(assessMfaRecency({ amr: at(300), now, maxAgeSeconds: MAX }), "fresh");
    assert.equal(assessMfaRecency({ amr: at(301), now, maxAgeSeconds: MAX }), "stale");
    assert.equal(assessMfaRecency({ amr: at(86_400), now, maxAgeSeconds: MAX }), "stale");
  });

  test("the newest TOTP entry wins, and 'mfa/totp' counts too", () => {
    const amr = [{ method: "totp", timestamp: now - 10_000 }, { method: "mfa/totp", timestamp: now - 20 }, { method: "password", timestamp: now }];
    assert.equal(assessMfaRecency({ amr, now, maxAgeSeconds: MAX }), "fresh");
  });

  test("a recent password login is NOT proof of a recent second factor", () => {
    assert.equal(assessMfaRecency({ amr: at(1, "password"), now, maxAgeSeconds: MAX }), "missing");
    assert.equal(assessMfaRecency({ amr: at(1, "otp"), now, maxAgeSeconds: MAX }), "missing");
  });

  test("missing, malformed and string-only amr all fail closed", () => {
    for (const amr of [undefined, null, [], "totp", {}, ["totp"], ["password", "totp"], [null], [{}], [{ method: "totp" }], [{ timestamp: now }],
      [{ method: "totp", timestamp: "now" }], [{ method: "totp", timestamp: NaN }], [{ method: "totp", timestamp: Infinity }], [{ method: "totp", timestamp: -5 }], [{ method: "totp", timestamp: 0 }], [{ method: 5, timestamp: now }]]) {
      assert.equal(assessMfaRecency({ amr, now, maxAgeSeconds: MAX }), "missing", JSON.stringify(amr));
    }
  });

  test("timestamps from the future are not trusted (allowed skew 60 s)", () => {
    assert.equal(assessMfaRecency({ amr: [{ method: "totp", timestamp: now + 30 }], now, maxAgeSeconds: MAX }), "fresh");
    assert.equal(assessMfaRecency({ amr: [{ method: "totp", timestamp: now + 61 }], now, maxAgeSeconds: MAX }), "missing");
    assert.equal(assessMfaRecency({ amr: [{ method: "totp", timestamp: now + 10_000_000 }], now, maxAgeSeconds: MAX }), "missing");
  });

  test("a garbage clock or window never yields fresh", () => {
    for (const bad of [NaN, Infinity]) assert.equal(assessMfaRecency({ amr: at(1), now: bad, maxAgeSeconds: MAX }), "missing");
    for (const bad of [0, -1, NaN]) assert.equal(assessMfaRecency({ amr: at(1), now, maxAgeSeconds: bad }), "missing");
  });

  test("malformed entries are ignored without discarding the good ones", () => {
    assert.deepEqual(parseAmr([null, "x", { method: "totp", timestamp: 5 }, { method: "totp" }]), [{ method: "totp", timestamp: 5 }]);
  });
});

describe("decideStepUp (sensitive actions)", () => {
  const now = 1_800_000_000;
  const base = { now, maxAgeSeconds: 300, hasVerifiedFactor: true };
  const fresh = [{ method: "totp", timestamp: now - 30 }];
  const stale = [{ method: "totp", timestamp: now - 5000 }];

  test("aal2 plus a fresh TOTP event is ok", () => assert.equal(decideStepUp({ ...base, currentLevel: "aal2", amr: fresh }), "ok"));
  test("aal2 but a stale or missing TOTP event needs re-verification", () => {
    assert.equal(decideStepUp({ ...base, currentLevel: "aal2", amr: stale }), "reverify");
    assert.equal(decideStepUp({ ...base, currentLevel: "aal2", amr: [] }), "reverify");
    assert.equal(decideStepUp({ ...base, currentLevel: "aal2", amr: ["totp"] }), "reverify");
  });
  test("aal1 always needs re-verification, even with a fresh-looking amr", () => assert.equal(decideStepUp({ ...base, currentLevel: "aal1", amr: fresh }), "reverify"));
  test("no verified factor means enrol first", () => assert.equal(decideStepUp({ ...base, hasVerifiedFactor: false, currentLevel: "aal2", amr: fresh }), "enrol"));
  test("unknown level is denied", () => {
    for (const lvl of [null, undefined, "AAL2", "", 2]) assert.equal(decideStepUp({ ...base, currentLevel: lvl, amr: fresh }), "deny");
  });
});

describe("safeNext (no open redirect, no loop)", () => {
  test("accepts admin paths and keeps the query", () => {
    assert.equal(safeNext("/admin/leads"), "/admin/leads");
    assert.equal(safeNext("/admin/leads?status=new&page=2"), "/admin/leads?status=new&page=2");
    assert.equal(safeNext("/admin/security"), "/admin/security");
    assert.equal(safeNext("/admin"), "/admin");
  });
  test("rejects everything that could leave the site or loop", () => {
    for (const bad of ["https://evil.test", "//evil.test", "/\\evil.test", "/admin\\..\\x", "javascript:alert(1)", "/pl", "/", "admin/leads", "", null, undefined, 5,
      "/administrator", "/admin/mfa", "/admin/mfa?next=/admin/mfa", "/admin/login", "/admin/login/x", "/admin/%0d%0aSet-Cookie:x", "/admin/leads\nx", "/admin/" + "a".repeat(400), "http://localhost/admin/leads"]) {
      assert.equal(safeNext(bad), "/admin/leads", JSON.stringify(bad));
    }
    assert.equal(safeNext("//evil.test", "/admin/security"), "/admin/security", "the fallback is configurable");
  });
});
