"use client";

import { useActionState } from "react";
import { Message } from "@/components/Message";
import { useT } from "@/features/admin-prefs/provider";
import { challengeFactor } from "../actions";

export function ChallengeForm({ next, factors }: { next: string; factors: { id: string; name: string }[] }) {
  const { t } = useT();
  const [result, action, pending] = useActionState(challengeFactor.bind(null, next), null);

  return (
    <form action={action} className="mt-8 grid gap-5">
      {factors.length > 1 ? (
        <div>
          <label htmlFor="factorId" className="mb-1 block text-sm">{t("mfa.device")}</label>
          <select id="factorId" name="factorId" className="field" defaultValue={factors[0]?.id}>
            {factors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      ) : (
        <input type="hidden" name="factorId" value={factors[0]?.id ?? ""} />
      )}
      <div>
        <label htmlFor="code" className="mb-1 block text-sm">{t("mfa.code")}</label>
        {/* autoFocus is intended here: this page has exactly one task. */}
        <input id="code" name="code" required autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 \-]{6,9}" maxLength={9}
          className="field font-mono text-lg tracking-widest" aria-invalid={result && !result.ok ? true : undefined} aria-describedby={result && !result.ok ? "code-error" : undefined} />
      </div>
      {result && !result.ok && <Message tone="error" id="code-error">{result.message}</Message>}
      <button className="btn btn-primary" disabled={pending}>{pending ? t("common.checking") : t("mfa.verify")}</button>
    </form>
  );
}
