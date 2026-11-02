"use server";

// Changes the admin language. A Server Action (not just a cookie written in the browser) because Next
// then re-renders the current page in the new language in the same round trip and drops cached pages
// that were rendered in the old one. It needs no session: the value is whitelisted by parseLang() and the
// cookie only picks a language. The theme is handled in the browser alone (CSS), see controls.tsx.
import { cookies } from "next/headers";
import { LANG_COOKIE, PREF_MAX_AGE_SECONDS, parseLang } from "./prefs.ts";

export async function setLanguage(value: string): Promise<void> {
  const store = await cookies();
  store.set(LANG_COOKIE, parseLang(value), {
    path: "/admin",
    maxAge: PREF_MAX_AGE_SECONDS,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
