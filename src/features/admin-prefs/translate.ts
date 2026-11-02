// Server-side translation helpers for the admin panel. The public website keeps next-intl and its own
// locale routing; the admin has two languages chosen by a cookie, so a flat, typed dictionary is
// enough and adds no dependency. Pure module (relative imports only): unit-tested with node --test.
// This file imports the full dictionaries: client code must import ./core.ts instead.
import { createTFrom, type Translate } from "./core.ts";
import { dictionaries, type MessageKey } from "./dictionary.ts";
import type { Lang } from "./prefs.ts";

export { createTFrom, format, pluralForm } from "./core.ts";
export type { PluralBase, Translate, TranslateCount, Vars } from "./core.ts";

export const createT = (lang: Lang) => createTFrom(lang, dictionaries[lang]);

/** Schema validation messages are dictionary keys ("v.*"). Anything else (a library default) falls back to a fixed text. */
export function issueText(t: Translate, message: string | undefined, fallback: MessageKey): string {
  return message !== undefined && message in dictionaries.pl ? t(message as MessageKey) : t(fallback);
}

/** Subset of the active dictionary that client components need (keeps the page payload small). */
export function clientMessages(lang: Lang, prefixes: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(dictionaries[lang])) if (prefixes.some((p) => k.startsWith(p))) out[k] = v;
  return out;
}
