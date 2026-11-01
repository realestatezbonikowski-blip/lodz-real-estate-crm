// Structural guards for the MFA screens (step 3: built, NOT enforced). Static checks, no network.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const read = (f: string) => readFileSync(f, "utf8");
// Code only: the files explain what they must NOT do in comments, and a guard should not trip on that.
const code = (f: string) => read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
const mfaActions = read("src/features/mfa/actions.ts");
const mfaActionsCode = code("src/features/mfa/actions.ts");
const mfaFiles = [
  "src/features/mfa/actions.ts",
  "src/features/mfa/state.ts",
  "src/features/mfa/session.ts",
  "src/app/admin/mfa/page.tsx",
  "src/app/admin/security/page.tsx",
  "src/features/mfa/components/EnrollPanel.tsx",
  "src/features/mfa/components/ChallengeForm.tsx",
  "src/features/mfa/components/FactorActions.tsx",
];

describe("MFA screens read no application data", () => {
  test("no table access and no dependence on the staff-profile gate", () => {
    for (const f of mfaFiles) {
      const src = read(f);
      assert.ok(!src.includes(".from("), `${f} must not query a table`);
      assert.ok(!/requireStaff|requireOwner/.test(src), `${f} must not use the staff gate`);
      assert.ok(!src.includes("features/crm/queries") && !src.includes("features/crm/auth"), `${f} must not import the CRM data layer`);
    }
  });

  test("the screens sit outside the authenticated (app) group, whose layout reads profiles", () => {
    assert.ok(!mfaFiles.some((f) => f.startsWith("src/app/admin/(app)")));
    assert.match(read("src/app/admin/(app)/layout.tsx"), /requireStaff\(\)/);
  });
});

describe("MFA server actions", () => {
  const fns = mfaActions
    .split("export async function ")
    .slice(1)
    .map((chunk) => ({ name: chunk.slice(0, chunk.indexOf("(")), body: chunk.slice(chunk.indexOf("{") + 1) }));

  test("exactly the expected actions exist, and each starts by validating the session", () => {
    assert.deepEqual(fns.map((f) => f.name).sort(), ["cancelEnrollment", "challengeFactor", "confirmEnrollment", "removeFactor", "startEnrollment"]);
    for (const f of fns) assert.match(f.body.trim().split("\n")[0] ?? "", /await requireMfaSession\(\)/, `${f.name} must validate the session first`);
  });

  test("codes are never logged, and every verification goes through the rate-limited path", () => {
    assert.ok(!mfaActions.includes("console."));
    assert.equal((mfaActions.match(/challengeAndVerify\(/g) ?? []).length, 1, "challengeAndVerify may only be called inside verifyFactor()");
    assert.ok(mfaActions.includes("attemptMfaVerify("));
  });

  test("removing a verified factor: confirmation, a code, and a fresh server-validated TOTP event, all BEFORE unenroll", () => {
    const body = mfaActions.slice(mfaActions.indexOf("export async function removeFactor"));
    for (const needle of ['"confirm"', "verifyFactor(", "assessMfaRecency(", "loadMfaState(", "mfa.unenroll("]) assert.ok(body.includes(needle), `removeFactor must use ${needle}`);
    assert.ok(body.indexOf("verifyFactor(") < body.indexOf("mfa.unenroll("));
    assert.ok(body.indexOf("assessMfaRecency(") < body.indexOf("mfa.unenroll("));
  });

  test("the post-challenge redirect only ever uses the validated address", () => {
    const body = mfaActionsCode.slice(mfaActionsCode.indexOf("export async function challengeFactor"), mfaActionsCode.indexOf("export async function removeFactor"));
    assert.ok(body.includes("redirect(safeNext(next))"));
    assert.equal((body.match(/redirect\(/g) ?? []).length, 1, "exactly one redirect, and it is the validated one");
  });
});

describe("security decisions use validated sources only", () => {
  test("no unverified token decoding, no cached session reads", () => {
    for (const f of mfaFiles) {
      const src = code(f);
      assert.ok(!/getAuthenticatorAssuranceLevel|decodeJWT|getSession\(/.test(src), `${f} must not decide from unverified or cached data`);
    }
    assert.ok(read("src/features/mfa/state.ts").includes("getClaims("));
    assert.ok(read("src/features/mfa/state.ts").includes("getUser("));
  });
});

describe("APPLICATION-LEVEL ENFORCEMENT: enrolled users must reach aal2", () => {
  // Decision (docs/overnight): requireStaff() applies the MFA policy. A user WITH a verified factor
  // cannot use the CRM at aal1. Users without a factor are not forced to enrol unless MFA_MODE=required.
  // Database-level enforcement (supabase/planned) is still NOT applied: that is a separate, approved step.
  test("requireStaff applies decideMfaAccess from validated state and routes to the challenge / enrolment screens", () => {
    const src = read("src/features/crm/auth.ts");
    assert.ok(/decideMfaAccess\(/.test(src) && /loadMfaState\(/.test(src));
    assert.ok(/redirect\("\/admin\/mfa"\)/.test(src) && /redirect\("\/admin\/security"\)/.test(src));
    assert.ok(/MFA_MODE/.test(src) && /"enrolled"/.test(src), "the default must be enrolled, never silently off");
  });
  test("the MFA screens never go through requireStaff (no redirect loop)", () => {
    for (const f of ["src/features/mfa/session.ts", "src/app/admin/mfa/page.tsx", "src/app/admin/security/page.tsx"]) {
      assert.ok(!/requireStaff|requireOwner/.test(read(f)), `${f} must not use requireStaff`);
    }
  });
  test("no migration enforces MFA, and the planned SQL stays unapplied", () => {
    for (const m of readdirSync("supabase/migrations")) assert.ok(!/aal2|mfa/i.test(read(join("supabase/migrations", m))), `migration ${m} must not enforce MFA yet`);
    assert.ok(readdirSync("supabase/planned").includes("mfa_enforcement.sql"));
  });
  test("a user without a factor is left alone by the policy in 'off' and 'enrolled' modes", async () => {
    const { decideMfaAccess } = await import("./policy.ts");
    for (const mode of ["off", "enrolled"] as const) {
      assert.equal(decideMfaAccess({ mode, currentLevel: "aal1", nextLevel: "aal1", hasVerifiedFactor: false }), "allow");
    }
  });
});
