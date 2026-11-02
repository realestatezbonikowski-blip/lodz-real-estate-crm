// Labels for the CRM. Texts come from the admin dictionary (Polish by default, English on request);
// stored data (names, notes, project names) is never translated.
//
// CLIENT-SAFE BY DESIGN: this file is imported by browser components (forms.tsx), so it may import TYPES
// only. It must never import ../admin-prefs/translate.ts, dictionary.ts or the dict-* files at runtime:
// that would put both complete dictionaries into every visitor's JavaScript. Callers pass in the `t`
// function they already have (from useT() in the browser, from getT() on the server).
// bundle.test.ts enforces this.
import type { Translate } from "../admin-prefs/core.ts";
import type { Lang } from "../admin-prefs/prefs.ts";
import type { LeadStatus } from "./schema";

export const statusLabel = (t: Translate, s: LeadStatus) => t(`status.${s}`);
export const activityLabel = (t: Translate, a: "note" | "call" | "email" | "meeting" | "status_change") => t(`act.${a}`);
export const sourceLabel = (t: Translate, s: "web_form" | "manual") => t(`source.${s}`);
export const roleLabel = (t: Translate, r: "owner" | "assistant") => t(`role.${r}`);
export const localeLabel = (t: Translate, l: string) => (l === "pl" || l === "uk" || l === "en" ? t(`locale.${l}`) : l);

const DATE_LOCALE: Record<Lang, string> = { pl: "pl-PL", en: "en-GB" };
/** Date and time in the CRM's time zone, formatted for the interface language. */
export const dateTime = (iso: string, lang: Lang = "pl") =>
  new Intl.DateTimeFormat(DATE_LOCALE[lang], { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Warsaw" }).format(new Date(iso));
