// Translation integrity: every locale has exactly the same keys as the Polish source, no value is
// empty, and placeholders stay visibly marked. A missing key must fail here, not silently fall back.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const load = (l: string) => JSON.parse(readFileSync(`messages/${l}.json`, "utf8")) as Record<string, unknown>;

function leaves(obj: unknown, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  if (typeof obj === "string") return out.set(prefix, obj);
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    for (const [kk, vv] of leaves(v, prefix ? `${prefix}.${k}` : k)) out.set(kk, vv);
  }
  return out;
}

const pl = leaves(load("pl"));

describe("messages", () => {
  for (const locale of ["uk", "en"]) {
    test(`${locale} has exactly the keys of pl`, () => {
      const other = leaves(load(locale));
      assert.deepEqual([...other.keys()].sort(), [...pl.keys()].sort());
    });
  }

  test("no empty values in any locale", () => {
    for (const locale of ["pl", "uk", "en"]) {
      for (const [key, value] of leaves(load(locale))) assert.ok(value.trim().length > 0, `${locale}:${key} is empty`);
    }
  });

  test("placeholder text stays in square brackets in every locale", () => {
    const keys = ["Home.identityTitle", "Home.identityBody", "Home.overviewBody", "Contact.pending", "LeadForm.privacyPlaceholder", "Footer.companyPlaceholder"];
    for (const locale of ["pl", "uk", "en"]) {
      const m = leaves(load(locale));
      for (const k of keys) assert.match(m.get(k) ?? "", /^\[.*\]$/, `${locale}:${k} must be a bracketed placeholder`);
    }
  });

  test("project facts are never published as numbers in messages", () => {
    // Provisional facts (floors, number of apartments) must not appear as confirmed claims.
    for (const locale of ["pl", "uk", "en"]) {
      for (const [key, value] of leaves(load(locale))) {
        if (key.startsWith("Projects.items.") || key.startsWith("Home.")) assert.ok(!/\b(15|16|17|18|19|20)\b/.test(value), `${locale}:${key} contains an unverified number`);
      }
    }
  });
});
