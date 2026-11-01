import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { activitySchema, assignSchema, contactSchema, listHref, manualLeadSchema, parseFilters, sanitizeSearch, searchWords, statusSchema } from "./schema.ts";

const UUID = "3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b";

describe("search sanitising (PostgREST filter injection)", () => {
  test("strips every character with meaning in an or=(...) filter", () => {
    for (const evil of ["a,status.eq.converted", "x),or(status.eq.new", "100%", "a*b", "back\\slash", "q\"uote", "a;b"]) {
      assert.ok(!/[,()*%\\";]/.test(sanitizeSearch(evil)), evil);
    }
  });
  test("keeps normal names, emails and Polish letters", () => {
    assert.equal(sanitizeSearch("  Żaneta   Nowak "), "Żaneta Nowak");
    assert.equal(sanitizeSearch("jan.kowalski+test@example.com"), "jan.kowalski+test@example.com");
    assert.equal(sanitizeSearch("Іван Петренко"), "Іван Петренко");
  });
  test("caps length and word count", () => {
    assert.equal(sanitizeSearch("a".repeat(500)).length, 80);
    assert.equal(searchWords("a b c d e f").length, 4);
    assert.deepEqual(searchWords(",,,"), []);
  });
});

describe("filter parsing", () => {
  test("accepts valid values", () => {
    const f = parseFilters({ status: "new", project: UUID, source: "manual", assigned: "none", archived: "1", page: "3", q: "kow" });
    assert.deepEqual(f, { q: "kow", status: "new", project: UUID, source: "manual", assigned: "none", followUp: undefined, includeArchived: true, page: 3 });
  });
  test("ignores invalid values instead of failing", () => {
    const f = parseFilters({ status: "hacked", project: "1 or 1=1", source: "x", assigned: "me", page: "-5", archived: "yes" });
    assert.deepEqual(f, { q: undefined, status: undefined, project: undefined, source: undefined, assigned: undefined, followUp: undefined, includeArchived: false, page: 1 });
  });
  test("array parameters use the first value", () => {
    assert.equal(parseFilters({ status: ["contacted", "new"] }).status, "contacted");
  });
  test("list links keep filters and reset paging when a filter changes", () => {
    const f = parseFilters({ status: "new", page: "4", q: "jan" });
    assert.equal(listHref(f, { page: "5" }), "/admin/leads?q=jan&status=new&page=5");
    assert.equal(listHref(f, { status: "meeting" }), "/admin/leads?q=jan&status=meeting");
    assert.equal(listHref(f, { status: undefined, q: undefined }), "/admin/leads");
  });
});

describe("action input validation", () => {
  test("a staff member can never log a status_change activity directly", () => {
    assert.ok(!activitySchema.safeParse({ type: "status_change", body: "x" }).success);
    assert.ok(activitySchema.safeParse({ type: "call", body: "Rozmowa" }).success);
  });
  test("activity body rules", () => {
    assert.ok(!activitySchema.safeParse({ type: "note", body: "   " }).success);
    assert.ok(!activitySchema.safeParse({ type: "note", body: "x".repeat(5001) }).success);
    assert.ok(!activitySchema.safeParse({ type: "note", body: "a\u0001b" }).success);
    assert.ok(activitySchema.safeParse({ type: "note", body: "linia1\nlinia2" }).success);
  });
  test("unknown fields are rejected", () => {
    assert.ok(!statusSchema.safeParse({ status: "new", actorId: UUID }).success);
    assert.ok(!statusSchema.safeParse({ status: "sold" }).success);
  });
  test("assignment accepts a staff id or empty (unassign)", () => {
    assert.equal(assignSchema.parse({ assignedTo: "" }).assignedTo, null);
    assert.equal(assignSchema.parse({ assignedTo: UUID }).assignedTo, UUID);
    assert.ok(!assignSchema.safeParse({ assignedTo: "not-a-uuid" }).success);
  });
  test("contact and manual-lead rules mirror the public form", () => {
    assert.ok(contactSchema.safeParse({ firstName: "Jan", lastName: "Nowak", phone: "+48 570 123 456", email: "A@B.pl" }).success);
    assert.ok(!contactSchema.safeParse({ firstName: "Jan", lastName: "Nowak", phone: "x", email: "a@b.pl" }).success);
    const m = manualLeadSchema.parse({ firstName: "Jan", lastName: "Nowak", phone: "570 123 456", email: "A@B.pl", message: "", projectId: "" });
    assert.deepEqual([m.email, m.message, m.projectId], ["a@b.pl", undefined, null]);
    // A manual lead can never carry attribution or notice fields.
    assert.ok(!manualLeadSchema.safeParse({ firstName: "J", lastName: "N", phone: "570 123 456", email: "a@b.pl", projectId: "", utmSource: "x" }).success);
  });
});
