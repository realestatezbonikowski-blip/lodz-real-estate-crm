"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Lang, Theme } from "./prefs.ts";
import { createTFrom, type Translate, type TranslateCount } from "./core.ts";

type Ctx = { lang: Lang; theme: Theme; t: Translate; tn: TranslateCount };
const PrefsContext = createContext<Ctx | null>(null);

/** Receives the language, the theme read from the cookies on the server, and the client-side subset of the texts. */
export function AdminPrefsProvider({ lang, theme, messages, children }: { lang: Lang; theme: Theme; messages: Record<string, string>; children: ReactNode }) {
  const value = useMemo<Ctx>(() => ({ lang, theme, ...createTFrom(lang, messages) }), [lang, theme, messages]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): Ctx {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used inside AdminPrefsProvider");
  return ctx;
}

/** Translation functions for client components. */
export function useT(): { t: Translate; tn: TranslateCount; lang: Lang } {
  const { t, tn, lang } = usePrefs();
  return { t, tn, lang };
}
