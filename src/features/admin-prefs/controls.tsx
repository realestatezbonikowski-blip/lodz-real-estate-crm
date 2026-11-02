"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore, useTransition } from "react";
import { setLanguage } from "./actions";
import { LANGS, THEME_COOKIE, parseTheme, prefCookie, type Lang, type Theme } from "./prefs.ts";
import { usePrefs } from "./provider";

const LANG_LABEL: Record<Lang, string> = { pl: "PL", en: "EN" };

// The theme lives on <html data-theme>. Reading it from there (not from a copy in React state) keeps every
// toggle on the page right even when the theme was changed by another one, for example on the security
// page before a client-side navigation to the CRM, where the layout is not re-rendered by the server.
function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
const readTheme = (): Theme => parseTheme(document.documentElement.dataset.theme);

/**
 * Compact theme + language controls for the admin header.
 * Theme: applied to <html data-theme> immediately and remembered in a cookie, so the server renders the
 * right theme on the next request (no flash). Language: a Server Action that re-renders the page.
 * Real <button>s: Tab, Enter and Space work; the current choice is exposed with aria-pressed.
 */
export function AdminPrefs() {
  const { lang, theme: serverTheme, t } = usePrefs();
  // Server and first client render use the theme the server rendered (no hydration mismatch); afterwards the DOM is the truth.
  const theme = useSyncExternalStore(subscribeToTheme, readTheme, () => serverTheme);
  const [pending, start] = useTransition();

  function toggleTheme() {
    const next: Theme = readTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      document.cookie = prefCookie(THEME_COOKIE, next, window.location.protocol === "https:");
    } catch {
      // Cookies blocked: the theme still applies until the page is reloaded.
    }
  }

  const label = theme === "dark" ? t("prefs.toLight") : t("prefs.toDark");
  return (
    <div className="prefs" data-pending={pending || undefined}>
      <button type="button" className="prefs-btn" onClick={toggleTheme} aria-label={label} title={label}>
        {theme === "dark" ? <Sun size={18} strokeWidth={1.75} aria-hidden="true" /> : <Moon size={18} strokeWidth={1.75} aria-hidden="true" />}
      </button>
      <div role="group" aria-label={t("prefs.language")} className="prefs-seg">
        {LANGS.map((l) => (
          <button
            key={l}
            type="button"
            lang={l}
            className="prefs-btn prefs-lang"
            aria-pressed={l === lang}
            aria-label={t(l === "pl" ? "prefs.pl" : "prefs.en")}
            onClick={() => { if (l !== lang) start(async () => { await setLanguage(l); }); }}
          >
            {LANG_LABEL[l]}
          </button>
        ))}
      </div>
    </div>
  );
}
