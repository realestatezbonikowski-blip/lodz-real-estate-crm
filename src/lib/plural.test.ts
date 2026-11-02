import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createT } from "../features/admin-prefs/translate.ts";
import { pluralPl } from "./plural.ts";

const F = { one: "lead", few: "leady", many: "leadów" };

describe("pluralPl (Polish)", () => {
  test("1 is singular", () => assert.equal(pluralPl(1, F), "lead"));

  test("2-4 take the 'few' form", () => {
    for (const n of [2, 3, 4]) assert.equal(pluralPl(n, F), "leady", String(n));
  });

  test("0 and 5-21 take the 'many' form", () => {
    for (const n of [0, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]) assert.equal(pluralPl(n, F), "leadów", String(n));
  });

  test("the teens exception: 12, 13, 14 are 'many' even though they end in 2, 3, 4", () => {
    for (const n of [12, 13, 14, 112, 113, 114, 212, 1012]) assert.equal(pluralPl(n, F), "leadów", String(n));
  });

  test("22-24, 32-34, 102-104 are 'few' again", () => {
    for (const n of [22, 23, 24, 32, 33, 34, 102, 103, 104, 122, 1002]) assert.equal(pluralPl(n, F), "leady", String(n));
  });

  test("25-31 and round numbers are 'many'; 21, 31, 101 are 'many' (only exactly 1 is singular)", () => {
    for (const n of [25, 26, 29, 30, 31, 100, 101, 111, 1000, 1001]) assert.equal(pluralPl(n, F), "leadów", String(n));
    assert.equal(pluralPl(21, F), "leadów");
  });

  test("agrees with the platform's Polish plural rules for 0..2000", () => {
    const rules = new Intl.PluralRules("pl");
    for (let n = 0; n <= 2000; n++) {
      const cat = rules.select(n);
      const expected = cat === "one" ? F.one : cat === "few" ? F.few : F.many;
      assert.equal(pluralPl(n, F), expected, `n=${n} (${cat})`);
    }
  });

  test("non-integers and non-finite values do not crash", () => {
    for (const n of [1.5, NaN, Infinity, -Infinity]) assert.equal(pluralPl(n, F), "leadów");
    assert.equal(pluralPl(-1, F), "lead");
    assert.equal(pluralPl(-3, F), "leady");
  });
});

describe("lead counter (what the CRM list shows)", () => {
  const leadCount = (n: number) => createT("pl").tn("leads.count", n);
  test("renders the number with the right form", () => {
    assert.deepEqual([1, 2, 5, 12, 22, 25].map(leadCount), ["1 lead", "2 leady", "5 leadów", "12 leadów", "22 leady", "25 leadów"]);
  });
});
