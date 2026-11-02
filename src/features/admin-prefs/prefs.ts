// Admin interface preferences: colour theme and language. Pure module (no Next.js imports), so it is
// unit-tested directly with node --test and shared by the server layout and the client toggles.
//
// Both preferences live in plain cookies, not in localStorage, for one reason: the server can read a
// cookie while rendering, so the very first byte of HTML already carries the right `data-theme` and
// `lang` (no flash of the wrong theme, no language swap after hydration). They hold no personal data
// and no secret, so they are readable by scripts on purpose (the toggle writes them without a round
// trip) and are scoped to /admin so the public website never sees them.
export const THEMES = ["dark", "light"] as const;
export const LANGS = ["pl", "en"] as const;
export type Theme = (typeof THEMES)[number];
export type Lang = (typeof LANGS)[number];

export const THEME_COOKIE = "crm-theme";
export const LANG_COOKIE = "crm-lang";
/** The existing look is dark and Polish; a visitor with no cookie keeps exactly that. */
export const DEFAULT_THEME: Theme = "dark";
export const DEFAULT_LANG: Lang = "pl";
export const PREF_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/** Anything that is not exactly a known value falls back to the default: a cookie is user input. */
export const parseTheme = (v: unknown): Theme => (v === "light" || v === "dark" ? v : DEFAULT_THEME);
export const parseLang = (v: unknown): Lang => (v === "en" || v === "pl" ? v : DEFAULT_LANG);

/** The `Set-Cookie`-style string for `document.cookie`. Secure is added on HTTPS only. */
export function prefCookie(name: typeof THEME_COOKIE | typeof LANG_COOKIE, value: Theme | Lang, secure: boolean): string {
  return `${name}=${value}; Path=/admin; Max-Age=${PREF_MAX_AGE_SECONDS}; SameSite=Lax${secure ? "; Secure" : ""}`;
}
