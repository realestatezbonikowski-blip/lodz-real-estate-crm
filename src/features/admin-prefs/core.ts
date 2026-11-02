// Client-safe translation core: no dictionary import, so the browser bundle contains only the subset of
// texts the server sends (see provider.tsx), not both full languages. Pure module (node --test).
import type { MessageKey } from "./dictionary.ts";
import type { Lang } from "./prefs.ts";

export type Vars = Record<string, string | number>;
export type Translate = (key: MessageKey, vars?: Vars) => string;
export type TranslateCount = (key: PluralBase, n: number, vars?: Vars) => string;

/** Keys that end in `.one` / `.few` / `.many` / `.other` form a plural family; `tn("leads.count", 3)` picks the form. */
export type PluralBase = MessageKey extends infer K ? (K extends `${infer B}.${"one" | "few" | "many" | "other"}` ? B : never) : never;

export function format(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

/** Polish has one/few/many, English one/other. Explicit arithmetic: no dependence on the runtime's ICU data. */
export function pluralForm(lang: Lang, n: number): "one" | "few" | "many" | "other" {
  const abs = Math.abs(n);
  if (lang === "en") return abs === 1 ? "one" : "other";
  if (!Number.isInteger(abs)) return "many";
  if (abs === 1) return "one";
  const last = abs % 10;
  const lastTwo = abs % 100;
  return last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? "few" : "many";
}

/** Builds `t` / `tn` over any message map (the full dictionary on the server, a subset in the browser). */
export function createTFrom(lang: Lang, messages: Record<string, string>): { t: Translate; tn: TranslateCount } {
  const t: Translate = (key, vars) => format(messages[key] ?? key, vars);
  const tn: TranslateCount = (base, n, vars) => {
    const form = pluralForm(lang, n);
    return format(messages[`${base}.${form}`] ?? messages[`${base}.other`] ?? messages[`${base}.many`] ?? base, { n, ...vars });
  };
  return { t, tn };
}
