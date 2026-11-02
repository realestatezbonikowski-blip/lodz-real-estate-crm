// Theme persistence, language selection and translation integrity for the admin panel.
// Static checks and pure functions only: no network, no browser.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { createTFrom, format, pluralForm } from "./core.ts";
import { dictionaries } from "./dictionary.ts";
import { DEFAULT_LANG, DEFAULT_THEME, LANG_COOKIE, PREF_MAX_AGE_SECONDS, THEME_COOKIE, parseLang, parseTheme, prefCookie } from "./prefs.ts";
import { clientMessages, createT, issueText } from "./translate.ts";

const read = (f: string) => readFileSync(f, "utf8");
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

describe("preferences: parsing and the cookie that stores them", () => {
  test("no cookie, or anything unexpected, keeps the previous look: dark and Polish", () => {
    assert.equal(DEFAULT_THEME, "dark");
    assert.equal(DEFAULT_LANG, "pl");
    for (const bad of [undefined, null, "", "LIGHT", "light ", "blue", "<script>", 1, {}]) {
      assert.equal(parseTheme(bad), "dark", String(bad));
      assert.equal(parseLang(bad), "pl", String(bad));
    }
  });
  test("only the exact known values are accepted", () => {
    assert.equal(parseTheme("light"), "light");
    assert.equal(parseTheme("dark"), "dark");
    assert.equal(parseLang("en"), "en");
    assert.equal(parseLang("pl"), "pl");
    assert.equal(parseLang("uk"), "pl", "the public site's Ukrainian is not an admin language");
  });
  test("the cookie survives reloads and navigation (1 year, whole /admin), stays off the public site, and is Secure on HTTPS", () => {
    const c = prefCookie(THEME_COOKIE, "light", true);
    assert.match(c, /^crm-theme=light; /);
    assert.match(c, /Path=\/admin;/, "scoped to the admin panel only");
    assert.match(c, new RegExp(`Max-Age=${PREF_MAX_AGE_SECONDS};`));
    assert.match(c, /SameSite=Lax/);
    assert.match(c, /; Secure$/);
    assert.ok(!prefCookie(LANG_COOKIE, "en", false).includes("Secure"), "plain http (local development) must still work");
    assert.ok(PREF_MAX_AGE_SECONDS >= 365 * 24 * 3600);
  });
});

describe("dictionary: Polish and English stay in step", () => {
  const pl = dictionaries.pl as Record<string, string>;
  const en = dictionaries.en as Record<string, string>;
  test("exactly the same keys", () => {
    assert.deepEqual(Object.keys(en).sort(), Object.keys(pl).sort());
  });
  test("no empty text, and every {placeholder} appears in both languages", () => {
    for (const k of Object.keys(pl)) {
      assert.ok(pl[k]!.length > 0 && en[k]!.length > 0, `${k} is empty`);
      assert.equal(placeholders(en[k]!), placeholders(pl[k]!), `${k}: placeholders differ`);
    }
  });
  test("English text is really English: no Polish letters (the language selector must change the whole UI)", () => {
    const polish = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
    const allowed = new Set(["prefs.pl"]); // the language's own name, shown in its own language
    for (const [k, v] of Object.entries(en)) if (!allowed.has(k)) assert.ok(!polish.test(v), `${k}: "${v}" contains Polish letters`);
  });
});

describe("translation helpers", () => {
  test("format fills known placeholders and leaves unknown ones visible", () => {
    assert.equal(format("a {n} b {x}", { n: 3 }), "a 3 b {x}");
    assert.equal(format("plain"), "plain");
  });
  test("plural forms: Polish one/few/many, English one/other", () => {
    assert.deepEqual([1, 2, 5, 12, 22, 25].map((n) => pluralForm("pl", n)), ["one", "few", "many", "many", "few", "many"]);
    assert.deepEqual([0, 1, 2, 5].map((n) => pluralForm("en", n)), ["other", "one", "other", "other"]);
  });
  test("the lead counter reads naturally in both languages", () => {
    const pl = createT("pl"), en = createT("en");
    assert.equal(pl.tn("leads.count", 1), "1 lead");
    assert.equal(pl.tn("leads.count", 3), "3 leady");
    assert.equal(pl.tn("leads.count", 12), "12 leadów");
    assert.equal(en.tn("leads.count", 1), "1 lead");
    assert.equal(en.tn("leads.count", 12), "12 leads");
    assert.equal(en.t("status.not_interested"), "Not interested");
    assert.equal(pl.t("status.not_interested"), "Niezainteresowany");
  });
  test("a missing key shows the key, never an empty string or a crash", () => {
    // @ts-expect-error deliberately not a real key
    assert.equal(createT("en").t("no.such.key"), "no.such.key");
  });
  test("validation messages: dictionary keys are translated, anything else falls back to a fixed text", () => {
    const en = createT("en").t, pl = createT("pl").t;
    assert.equal(issueText(en, "v.pwMin", "common.checkForm"), "The password must have at least 12 characters.");
    assert.equal(issueText(pl, "v.pwMin", "common.checkForm"), "Hasło musi mieć co najmniej 12 znaków.");
    assert.equal(issueText(en, "Invalid input: expected string", "common.checkForm"), "Check the form.", "a library default must not reach the screen");
    assert.equal(issueText(en, undefined, "common.checkForm"), "Check the form.");
  });
  test("the browser receives only the prefixes it asked for, in the chosen language", () => {
    const m = clientMessages("en", ["prefs.", "common.saving"]);
    assert.equal(m["prefs.toLight"], "Switch to light theme");
    assert.equal(m["common.saving"], "Saving…");
    assert.equal(m["leads.title"], undefined, "server-only texts are not shipped");
    const { t } = createTFrom("en", m);
    assert.equal(t("prefs.toDark"), "Switch to dark theme");
  });
});

describe("no flash and no hydration mismatch (structural)", () => {
  const layout = read("src/app/admin/layout.tsx");
  test("the server reads both cookies and renders them on <html> in the first response", () => {
    assert.match(layout, /getPrefs\(\)/);
    assert.match(layout, /<html lang=\{lang\} data-theme=\{theme\}/);
  });
  test("the toggle changes <html data-theme> immediately and writes the cookie; the language goes through a Server Action", () => {
    const c = read("src/features/admin-prefs/controls.tsx");
    assert.match(c, /document\.documentElement\.dataset\.theme = next/);
    assert.match(c, /prefCookie\(THEME_COOKIE/);
    assert.match(c, /setLanguage\(l\)/);
    assert.match(c, /aria-pressed=\{l === lang\}/, "the current language is exposed to assistive technology");
    assert.match(c, /aria-label=\{label\}/, "the icon-only theme button has an accessible name");
  });
  test("the language action whitelists its input and sets an /admin-scoped cookie", () => {
    const a = read("src/features/admin-prefs/actions.ts");
    assert.match(a, /parseLang\(value\)/);
    assert.match(a, /path: "\/admin"/);
  });
  test("the client bundle gets the small helper module, never the full dictionaries", () => {
    const provider = read("src/features/admin-prefs/provider.tsx");
    assert.ok(!/dictionary|translate\.ts|dict-(pl|en)/.test(provider), "provider.tsx must not import the dictionaries");
    assert.ok(!/dictionary\.ts"|dict-(pl|en)/.test(read("src/features/admin-prefs/core.ts").replace(/import type[^\n]*\n/g, "")), "core.ts imports types only");
  });
  test("the controls are on every admin header and standalone admin screen", () => {
    for (const f of ["src/app/admin/(app)/layout.tsx", "src/app/admin/login/page.tsx", "src/app/admin/mfa/page.tsx", "src/app/admin/security/page.tsx", "src/app/admin/set-password/page.tsx"]) {
      assert.match(read(f), /<AdminPrefs \/>/, `${f} must offer the theme/language controls`);
    }
  });
});

describe("the public website is untouched", () => {
  test("the admin cookies are scoped to /admin and the public layout never reads them", () => {
    const publicLayout = read("src/app/[locale]/layout.tsx");
    assert.ok(!/crm-theme|crm-lang|admin-prefs/.test(publicLayout));
    assert.ok(!read("src/proxy.ts").includes("admin-prefs"), "locale routing for public pages is unchanged");
  });
});

describe("every text a client component asks for is actually sent to the browser (regression: the error screen showed raw keys)", () => {
  function* files(dir: string): Generator<string> {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) yield* files(p);
      else if (/\.tsx?$/.test(n) && !/\.test\./.test(n)) yield p;
    }
  }
  const prefixes = [...read("src/app/admin/layout.tsx").matchAll(/CLIENT_PREFIXES = \[([^\]]*)\]/g)][0]![1]!.match(/"[^"]+"/g)!.map((s) => s.slice(1, -1));
  const keys = Object.keys(dictionaries.pl);
  const clientFiles = [...files("src")].filter((f) => /^\s*"use client";/.test(read(f)) && /useT\(|usePrefs\(/.test(read(f)));

  test("the layout lists the prefixes it ships", () => assert.ok(prefixes.length >= 8, prefixes.join(",")));
  test("there are client components that translate (the scan found them)", () => assert.ok(clientFiles.length >= 6, clientFiles.join(", ")));
  test("every dictionary key written in a client component starts with a shipped prefix", () => {
    const missing: string[] = [];
    for (const f of clientFiles) {
      const src = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      for (const m of src.matchAll(/"([a-z_]+(?:\.[A-Za-z_]+)+)"/g)) {
        const literal = m[1]!;
        const isKey = keys.includes(literal) || keys.some((k) => k.startsWith(`${literal}.`)); // plural bases like "team.openLeads"
        if (isKey && !prefixes.some((p) => literal.startsWith(p))) missing.push(`${f}: ${literal}`);
      }
    }
    assert.deepEqual(missing, []);
  });
  test("keys built from a template (status.${s}, act.${a}) belong to shipped prefixes too", () => {
    for (const p of ["status.", "act."]) assert.ok(prefixes.includes(p), `${p} must be shipped: forms.tsx builds those keys`);
  });
});
