"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { TurnstileWidget } from "./TurnstileWidget";

// Public key by design (NEXT_PUBLIC_). The matching secret is server-only and never reaches this file.
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

type ErrorCode = "invalid" | "invalid_project" | "verification" | "busy" | "unavailable";
type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "success" }
  | { kind: "error"; code: ErrorCode; fields: string[] };

type FieldProps = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  maxLength: number;
  autoComplete: string;
  inputMode?: "tel" | "email" | "text";
  rows?: number;
  invalid: boolean;
  errorText: string;
};

// Defined at module level on purpose: a component declared inside LeadForm would be re-created on
// every render, remounting the uncontrolled inputs and wiping what the visitor typed.
function Field(props: FieldProps) {
  const errId = `${props.name}-error`;
  const shared = {
    id: props.name,
    name: props.name,
    required: props.required,
    maxLength: props.maxLength,
    autoComplete: props.autoComplete,
    "aria-invalid": props.invalid || undefined,
    "aria-describedby": props.invalid ? errId : undefined,
    className: "field",
  };
  return (
    <div>
      <label htmlFor={props.name} className="mb-1 block text-sm">
        {props.label}
      </label>
      {props.rows ? (
        <textarea {...shared} rows={props.rows} />
      ) : (
        <input {...shared} type={props.type ?? "text"} inputMode={props.inputMode} />
      )}
      {props.invalid && (
        <p id={errId} className="mt-1 text-sm text-accent">
          {props.errorText}
        </p>
      )}
    </div>
  );
}

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
    let code: ErrorCode = "unavailable";
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
      <p role="status" className="card p-6 text-lg">
        {t("success")}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field invalid={bad("firstName")} errorText={t("fieldError")} name="firstName" label={t("firstName")} required maxLength={100} autoComplete="given-name" />
        <Field invalid={bad("lastName")} errorText={t("fieldError")} name="lastName" label={t("lastName")} required maxLength={100} autoComplete="family-name" />
      </div>
      <Field invalid={bad("phone")} errorText={t("fieldError")} name="phone" label={t("phone")} type="tel" inputMode="tel" required maxLength={25} autoComplete="tel" />
      <Field invalid={bad("email")} errorText={t("fieldError")} name="email" label={t("email")} type="email" inputMode="email" required maxLength={254} autoComplete="email" />
      <Field invalid={bad("message")} errorText={t("fieldError")} name="message" label={t("message")} maxLength={2000} autoComplete="off" rows={4} />

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
        <p role="alert" className="text-sm text-accent">
          {t(`errors.${state.code}`)}
        </p>
      )}

      <div>
        <button type="submit" disabled={!token || state.kind === "sending"} className="btn btn-primary">
          {state.kind === "sending" ? t("sending") : t("submit")}
        </button>
      </div>
    </form>
  );
}
