"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { TurnstileWidget } from "./TurnstileWidget";

// Public key by design (NEXT_PUBLIC_). The matching secret is server-only and never reaches this file.
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "success" }
  | { kind: "error"; code: "invalid" | "invalid_project" | "verification" | "busy" | "unavailable"; fields: string[] };

export function LeadForm({ projectSlug }: { projectSlug?: string }) {
  const t = useTranslations("LeadForm");
  const locale = useLocale();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [token, setToken] = useState<string | null>(null);
  const [challenge, setChallenge] = useState(0);

  const bad = (name: string) => state.kind === "error" && state.fields.includes(name);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token || state.kind === "sending") return;
    const form = new FormData(e.currentTarget);
    const text = (k: string) => String(form.get(k) ?? "");

    const params = new URLSearchParams(window.location.search);
    const utm = (k: string) => params.get(k) ?? undefined;

    setState({ kind: "sending" });
    let code: Extract<State, { kind: "error" }>["code"] = "unavailable";
    let fields: string[] = [];
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: text("firstName"),
          lastName: text("lastName"),
          phone: text("phone"),
          email: text("email"),
          message: text("message"),
          website: text("website"), // honeypot
          locale,
          projectSlug: projectSlug ?? null,
          utmSource: utm("utm_source"),
          utmMedium: utm("utm_medium"),
          utmCampaign: utm("utm_campaign"),
          landingPath: window.location.pathname,
          referrer: document.referrer || undefined,
          turnstileToken: token,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { status?: string; fields?: string[] };
      if (res.ok && data.status === "ok") {
        setState({ kind: "success" });
        return;
      }
      if (data.status === "invalid") {
        code = "invalid";
        fields = data.fields ?? [];
      } else if (data.status === "invalid_project") code = "invalid_project";
      else if (data.status === "verification_failed") code = "verification";
      else if (res.status === 429) code = "busy";
    } catch {
      /* network error: keep "unavailable" */
    }
    setState({ kind: "error", code, fields });
    setToken(null);
    setChallenge((n) => n + 1); // Turnstile tokens are single-use
  }

  if (state.kind === "success") {
    return (
      <p role="status" className="rounded-md border border-border p-4">
        {t("success")}
      </p>
    );
  }

  const input = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2";

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          {t("firstName")}
          <input name="firstName" required maxLength={100} autoComplete="given-name" aria-invalid={bad("firstName")} className={input} />
        </label>
        <label className="block text-sm">
          {t("lastName")}
          <input name="lastName" required maxLength={100} autoComplete="family-name" aria-invalid={bad("lastName")} className={input} />
        </label>
      </div>
      <label className="block text-sm">
        {t("phone")}
        <input name="phone" type="tel" required maxLength={25} autoComplete="tel" aria-invalid={bad("phone")} className={input} />
      </label>
      <label className="block text-sm">
        {t("email")}
        <input name="email" type="email" required maxLength={254} autoComplete="email" aria-invalid={bad("email")} className={input} />
      </label>
      <label className="block text-sm">
        {t("message")}
        <textarea name="message" rows={4} maxLength={2000} aria-invalid={bad("message")} className={input} />
      </label>

      {/* Honeypot: hidden from people and assistive technology; bots tend to fill it. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <p className="text-sm text-muted">{t("privacyPlaceholder")}</p>

      {SITE_KEY ? (
        <TurnstileWidget siteKey={SITE_KEY} resetKey={challenge} onToken={setToken} />
      ) : (
        <p className="text-sm text-muted">{t("notConfigured")}</p>
      )}

      {state.kind === "error" && (
        <p role="alert" className="text-sm">
          {t(`errors.${state.code}`)}
        </p>
      )}

      <button
        type="submit"
        disabled={!token || state.kind === "sending"}
        className="rounded-md bg-foreground px-4 py-2 text-background disabled:opacity-50"
      >
        {state.kind === "sending" ? t("sending") : t("submit")}
      </button>
    </form>
  );
}
