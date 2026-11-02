"use client";

import { useActionState } from "react";
import { useT } from "@/features/admin-prefs/provider";
import { Notice } from "@/features/crm/components/forms";
import { inviteOpiekun, setMemberActive, setPassword } from "./actions";

export function InviteForm({ enabled }: { enabled: boolean }) {
  const { t } = useT();
  const [result, action, pending] = useActionState(inviteOpiekun, null);
  const bad = (n: string) => (result && !result.ok && result.fields?.includes(n)) || undefined;
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="fullName" className="mb-1 block text-sm">{t("team.agentName")}</label>
        <input id="fullName" name="fullName" required maxLength={120} autoComplete="off" autoCapitalize="words" className="field" aria-invalid={bad("fullName")} />
      </div>
      <div>
        <label htmlFor="email" className="mb-1 block text-sm">{t("team.agentEmail")}</label>
        <input id="email" name="email" type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} required maxLength={254} autoComplete="off" className="field" aria-invalid={bad("email")} />
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button className="btn btn-primary" disabled={pending || !enabled}>{pending ? t("common.sending") : t("team.sendInvite")}</button>
        <span className="text-sm text-muted">{t("team.inviteHint")}</span>
      </div>
      <div className="sm:col-span-2"><Notice result={result} /></div>
    </form>
  );
}

export function ActiveToggle({ userId, active, name }: { userId: string; active: boolean; name: string }) {
  const { t } = useT();
  const [result, action, pending] = useActionState(setMemberActive, null);
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="active" value={String(!active)} />
      <button className={`btn ${active ? "btn-danger" : "btn-ghost"} min-h-11 px-3 text-sm`} disabled={pending} aria-label={t(active ? "team.deactivateAria" : "team.activateAria", { name })}>
        {pending ? t("common.saving") : active ? t("team.deactivate") : t("team.reactivate")}
      </button>
      <Notice result={result} />
    </form>
  );
}

export function PasswordForm() {
  const { t } = useT();
  const [result, action, pending] = useActionState(setPassword, null);
  const bad = (n: string) => (result && !result.ok && result.fields?.includes(n)) || undefined;
  return (
    <form action={action} className="mt-8 grid gap-5">
      <div>
        <label htmlFor="password" className="mb-1 block text-sm">{t("pw.new")}</label>
        <input id="password" name="password" type="password" required minLength={12} maxLength={72} autoComplete="new-password" className="field" aria-invalid={bad("password")} />
      </div>
      <div>
        <label htmlFor="confirm" className="mb-1 block text-sm">{t("pw.repeat")}</label>
        <input id="confirm" name="confirm" type="password" required minLength={12} maxLength={72} autoComplete="new-password" className="field" aria-invalid={bad("confirm")} />
      </div>
      <Notice result={result} />
      <button className="btn btn-primary" disabled={pending}>{pending ? t("common.saving") : t("pw.submit")}</button>
    </form>
  );
}
