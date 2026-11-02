// Server-side access to the admin preferences: read from cookies while rendering, so the first byte of
// HTML already has the right theme and language. Used by layouts, pages and server actions.
import { cookies } from "next/headers";
import { cache } from "react";
import { LANG_COOKIE, THEME_COOKIE, parseLang, parseTheme } from "./prefs.ts";
import { createT } from "./translate.ts";

/** Cached per request: the layout, the page and the actions share one cookie read. */
export const getPrefs = cache(async () => {
  const store = await cookies();
  return { theme: parseTheme(store.get(THEME_COOKIE)?.value), lang: parseLang(store.get(LANG_COOKIE)?.value) };
});

/** `const { t, tn, lang } = await getT();` */
export async function getT() {
  const { lang } = await getPrefs();
  return { lang, ...createT(lang) };
}
