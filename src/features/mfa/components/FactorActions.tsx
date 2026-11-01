"use client";

import { useActionState } from "react";
import { Message } from "@/components/Message";
import { cancelEnrollment, removeFactor } from "../actions";

/** Pending (never verified) enrolment: can simply be dropped. */
export function CancelPending({ factorId }: { factorId: string }) {
  return (
    <form action={cancelEnrollment.bind(null, factorId)}>
      <button className="link text-sm">Anuluj dodawanie</button>
    </form>
  );
}

/** Removing a verified factor: confirmation + a fresh code from an enrolled factor. */
export function RemoveFactor({ factorId, isLast, verifiers }: { factorId: string; isLast: boolean; verifiers: { id: string; name: string }[] }) {
  const [result, action, pending] = useActionState(removeFactor.bind(null, factorId), null);

  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-danger">Usuń</summary>
      <form action={action} className="mt-3 grid max-w-sm gap-3 border border-border p-4">
        <p className="text-muted">
          Po usunięciu ta aplikacja przestanie działać jako drugi składnik. Aby potwierdzić, że to Ty, wpisz aktualny kod z jednej z aplikacji.
        </p>
        {verifiers.length > 1 && (
          <div>
            <label htmlFor={`verify-${factorId}`} className="mb-1 block">Kod z aplikacji</label>
            <select id={`verify-${factorId}`} name="verifyWith" defaultValue={factorId} className="field">
              {verifiers.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label htmlFor={`code-${factorId}`} className="mb-1 block">6-cyfrowy kod</label>
          <input id={`code-${factorId}`} name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 \-]{6,9}" maxLength={9} className="field font-mono tracking-widest" />
        </div>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="confirm" className="check" /> Potwierdzam usunięcie tej aplikacji</label>
        {isLast && (
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" name="confirmLast" className="check" />
            To moja jedyna aplikacja. Rozumiem, że konto zostanie zabezpieczone tylko hasłem.
          </label>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-danger" disabled={pending}>{pending ? "Usuwanie…" : "Usuń aplikację"}</button>
          {result && <Message tone={result.ok ? "success" : "error"}>{result.message}</Message>}
        </div>
      </form>
    </details>
  );
}
