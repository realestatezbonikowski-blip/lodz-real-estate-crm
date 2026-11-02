// The admin colour themes, checked from the real stylesheet: the light theme redefines every token the
// dark one defines (so no component can be left with a dark-only colour), no CRM rule hard-codes a theme
// colour, and the text/background pairs the UI uses meet WCAG AA (4.5:1) in BOTH themes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const css = readFileSync("src/app/globals.css", "utf8");

/** Custom properties declared in every block whose selector is exactly `selector`. */
function tokens(selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = new RegExp(`(^|\\n)${selector.replace(/[.[\]="]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "g");
  for (const m of css.matchAll(re)) for (const d of m[2]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[d[1]!] = d[2]!.trim();
  return out;
}

const dark = { ...tokens(":root"), ...tokens(".crm") };
const light = { ...dark, ...tokens('.crm[data-theme="light"]') };

type Rgba = [number, number, number, number];
function parse(v: string, theme: Record<string, string>): Rgba {
  v = v.trim();
  const ref = /^var\((--[\w-]+)\)$/.exec(v);
  if (ref) return parse(theme[ref[1]!]!, theme);
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const h = hex[1]!.length === 3 ? [...hex[1]!].map((c) => c + c).join("") : hex[1]!;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const fn = /^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*(?:\/\s*([\d.]+))?\s*\)$/.exec(v);
  if (fn) return [Number(fn[1]), Number(fn[2]), Number(fn[3]), fn[4] === undefined ? 1 : Number(fn[4])];
  throw new Error(`cannot parse colour: ${v}`);
}
const over = (fg: Rgba, bg: Rgba): Rgba => [0, 1, 2].map((i) => fg[i]! * fg[3] + bg[i]! * (1 - fg[3])).concat(1) as Rgba;
const lum = ([r, g, b]: Rgba) => {
  const f = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: Rgba, b: Rgba) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

describe("light theme completeness", () => {
  test("the dark theme defines the tokens; the light theme overrides every one that is theme-specific", () => {
    const lightOnly = tokens('.crm[data-theme="light"]');
    const crmTokens = tokens(".crm");
    assert.ok(Object.keys(crmTokens).length > 20 && Object.keys(lightOnly).length > 20, "the stylesheet blocks were found and parsed");
    const missing = Object.keys(crmTokens).filter((k) => !(k in lightOnly));
    assert.deepEqual(missing, [], `tokens defined for the dark theme but not redefined for light: ${missing.join(", ")}`);
  });
  test("the dark theme stays the default, and color-scheme follows the theme (native controls, scrollbars)", () => {
    assert.match(css, /\.crm \{\s*color-scheme: dark;/);
    assert.match(css, /\.crm\[data-theme="light"\] \{\s*color-scheme: light;/);
  });
  test("CRM rules use theme tokens: no hard-coded brass/graphite colours after the CRM marker", () => {
    const crmCss = css.slice(css.indexOf('CRM: "Graphite Console"'));
    // Everything that varies by theme lives in the two token blocks; strip them, then look for literals.
    const rules = crmCss.replace(/\n\.crm \{[^}]*\}/, "").replace(/\n\.crm\[data-theme="light"\] \{[^}]*\}/, "");
    const literals = [...rules.matchAll(/rgb\((?:210 164 106|14 19 24|255 255 255)\s*\/[^)]*\)|#0e1318|#1a0b0c/g)].map((m) => m[0]);
    assert.deepEqual(literals, [], "use var(--accent-rgb), var(--header-bg), var(--hilite)... so the light theme can follow");
  });
});

describe("contrast (WCAG AA, 4.5:1) in both themes, computed from the stylesheet", () => {
  for (const [name, theme] of [["dark", dark], ["light", light]] as const) {
    const c = (token: string, on?: string) => {
      const fg = parse(`var(--${token})`, theme);
      return on ? over(fg, parse(`var(--${on})`, theme)) : fg;
    };
    const bg = (token: string) => parse(`var(--${token})`, theme);
    const pairs: [string, Rgba, Rgba][] = [
      ["text on page", c("ink"), bg("paper")],
      ["text on card/panel", c("ink"), bg("surface")],
      ["muted text on page", c("muted"), bg("paper")],
      ["muted text on card", c("muted"), bg("surface")],
      ["muted text on neutral badge (paper-deep)", c("muted"), bg("paper-deep")],
      ["links/accent on page", c("accent"), bg("paper")],
      ["links/accent on card", c("accent"), bg("surface")],
      ["primary button text", c("paper"), bg("ink")],
      ["primary button hover text", c("paper"), bg("accent")],
      ["destructive button hover text", parse(theme["--danger-hover-text"]!, theme), bg("danger")],
      ["selected text", parse(theme["--on-accent"]!, theme), bg("accent")],
      ["solid info badge", parse(theme["--info-solid-text"]!, theme), bg("info")],
      ...(["success", "warning", "danger", "info"] as const).flatMap((tone): [string, Rgba, Rgba][] => [
        [`${tone} text on card`, c(tone), bg("surface")],
        [`${tone} text on its tint badge`, c(tone), over(parse(theme[`--${tone}-tint`]!, theme), bg("surface"))],
      ]),
    ];
    test(`${name}: every text/background pair is at least 4.5:1`, () => {
      assert.ok(pairs.length >= 20, "pairs were computed");
      const bad = pairs.map(([label, fg, back]) => [label, ratio(fg, back)] as const).filter(([, r]) => r < 4.5);
      assert.deepEqual(bad.map(([l, r]) => `${l}: ${r.toFixed(2)}`), []);
    });
  }
});
