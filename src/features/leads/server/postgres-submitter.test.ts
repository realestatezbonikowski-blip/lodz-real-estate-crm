import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { InvalidProjectError, type SubmitLeadParams } from "../handler.ts";
import { createLeadSubmitter, IntakeError, type SqlRunner } from "./postgres-submitter.ts";

const params: SubmitLeadParams = {
  firstName: "Jan", lastName: "Kowalski", phone: "+48 570 123 456", email: "jan@example.com",
  projectSlug: "radomska", message: null, locale: "pl", utmSource: null, utmMedium: null,
  utmCampaign: null, landingPath: "/pl/projects/radomska", referrer: null, privacyNoticeVersion: "placeholder-0",
};

describe("Option B submitter", () => {
  test("passes the 13 arguments in submit_lead's order and returns the outcome", async () => {
    let seen: { text: string; args: (string | null)[] } | undefined;
    const run: SqlRunner = async (text, args) => ((seen = { text, args }), [{ result: "created" }]);
    assert.equal(await createLeadSubmitter(run).submit(params), "created");
    assert.match(seen!.text, /^select public\.submit_lead\(\$1,.*\$13\) as result$/);
    assert.deepEqual(seen!.args, [
      "Jan", "Kowalski", "+48 570 123 456", "jan@example.com", "radomska", null, "pl",
      null, null, null, "/pl/projects/radomska", null, "placeholder-0",
    ]);
  });

  test("accepts exactly the three documented outcomes", async () => {
    for (const r of ["created", "duplicate", "rate_limited"]) {
      assert.equal(await createLeadSubmitter(async () => [{ result: r }]).submit(params), r);
    }
    for (const bad of [undefined, null, "ok", 1, ""]) {
      await assert.rejects(createLeadSubmitter(async () => [{ result: bad }]).submit(params), IntakeError);
    }
    await assert.rejects(createLeadSubmitter(async () => []).submit(params), IntakeError);
  });

  test("invalid_project maps to a typed error; every other failure is opaque", async () => {
    await assert.rejects(
      createLeadSubmitter(async () => { throw Object.assign(new Error("invalid_project"), { code: "22023" }); }).submit(params),
      InvalidProjectError,
    );
    // Same SQLSTATE but a different message must NOT be treated as an invalid project.
    await assert.rejects(
      createLeadSubmitter(async () => { throw Object.assign(new Error("other"), { code: "22023" }); }).submit(params),
      IntakeError,
    );
    const leaky = Object.assign(new Error('password authentication failed for user "lead_intake.abcdefghij"'), { code: "28P01" });
    await assert.rejects(createLeadSubmitter(async () => { throw leaky; }).submit(params), (e: Error) => {
      assert.ok(e instanceof IntakeError);
      assert.ok(!/lead_intake|password/.test(e.message), "the original message must not propagate");
      return true;
    });
  });
});
