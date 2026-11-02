"use client";

import { useActionState } from "react";
import { Message } from "@/components/Message";
import { useT } from "@/features/admin-prefs/provider";
import { cancelEnrollment, removeFactor } from "../actions";

/** Pending (never verified) enrolment: can simply be dropped. */
export function CancelPending({ factorId }: { factorId: string }) {
  const { t } = useT();
  return (
    <form action={cancelEnrollment.bind(null, factorId)}>
      <button className="link inline-flex min-h-11 items-center text-sm">{t("mfa.cancelAdd")}</button>
    </form>
  );
}

/** Removing a verified factor: confirmation + a fresh code from an enrolled factor. */
export function RemoveFactor({ factorId, isLast, verifiers }: { factorId: string; isLast: boolean; verifiers: { id: string; name: string }[] }) {
  const { t } = useT();
  const [result, action, pending] = useActionState(removeFactor.bind(null, factorId), null);

  return (
    <details className="text-sm">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-danger">{t("mfa.remove")}</summary>
      <form action={action} className="mt-3 grid max-w-sm gap-3 border border-border p-4">
        <p className="text-muted">{t("mfa.removeInfo")}</p>
        {verifiers.length > 1 && (
          <div>
            <label htmlFor={`verify-${factorId}`} className="mb-1 block">{t("mfa.appCode")}</label>
            <select id={`verify-${factorId}`} name="verifyWith" defaultValue={factorId} className="field">
              {verifiers.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label htmlFor={`code-${factorId}`} className="mb-1 block">{t("mfa.removeCode")}</label>
          <input id={`code-${factorId}`} name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 \-]{6,9}" maxLength={9} className="field font-mono tracking-widest" />
        </div>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="confirm" className="check" /> {t("mfa.removeCheck")}</label>
        {isLast && (
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" name="confirmLast" className="check" />
            {t("mfa.lastCheck")}
          </label>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-danger" disabled={pending}>{pending ? t("common.deleting") : t("mfa.removeBtn")}</button>
          {result && <Message tone={result.ok ? "success" : "error"}>{result.message}</Message>}
        </div>
      </form>
    </details>
  );
}
