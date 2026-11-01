"use client";

import { useActionState } from "react";
import { Message } from "@/components/Message";
import { cancelEnrollment, confirmEnrollment, startEnrollment } from "../actions";
import type { EnrolState } from "../types";

const IDLE: EnrolState = { step: "idle" };

function ResultMessage({ result }: { result: { ok: boolean; message: string } | null }) {
  if (!result) return null;
  return <Message tone={result.ok ? "success" : "error"}>{result.message}</Message>;
}

export function EnrollPanel() {
  const [enrol, start, starting] = useActionState(startEnrollment, IDLE);

  if (enrol.step === "scan") return <ScanStep key={enrol.factorId} {...enrol} />;

  return (
    <form action={start} className="grid max-w-md gap-4">
      <div>
        <label htmlFor="name" className="mb-1 block text-sm">Nazwa urządzenia (opcjonalnie)</label>
        <input id="name" name="name" maxLength={40} autoComplete="off" placeholder="np. Telefon służbowy" className="field" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={starting}>{starting ? "Przygotowywanie…" : "Dodaj aplikację uwierzytelniającą"}</button>
        {enrol.step === "error" && <Message tone="error">{enrol.message}</Message>}
      </div>
    </form>
  );
}

function ScanStep({ factorId, qrSrc, secret, otpUri }: { factorId: string; qrSrc: string | null; secret: string | null; otpUri: string | null }) {
  const [result, confirm, confirming] = useActionState(confirmEnrollment.bind(null, factorId), null);

  if (result?.ok) {
    // The QR code and the key are dropped from the screen as soon as the factor is verified.
    return (
      <div className="card p-5">
        <Message tone="success" className="text-base">{result.message}</Message>
      </div>
    );
  }

  return (
    <div className="grid max-w-xl gap-6">
      <ol className="grid list-decimal gap-2 pl-5 text-sm">
        <li>Otwórz aplikację uwierzytelniającą na telefonie (np. Google Authenticator, Microsoft Authenticator, 1Password).</li>
        <li>Zeskanuj kod QR albo wpisz klucz ręcznie.</li>
        <li>Wpisz poniżej 6-cyfrowy kod z aplikacji.</li>
      </ol>

      {qrSrc && (
        <div className="w-fit border border-border bg-white p-3">
          {/* A data: SVG shown through <img> cannot run scripts; next/image adds nothing for a one-off QR code. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrSrc} alt="Kod QR do skonfigurowania aplikacji uwierzytelniającej" width={200} height={200} />
        </div>
      )}

      <div className="grid gap-2 text-sm">
        {otpUri && <p><a className="link" href={otpUri}>Otwórz bezpośrednio w aplikacji na tym urządzeniu</a></p>}
        {secret && (
          <details>
            <summary className="cursor-pointer">Nie możesz zeskanować kodu? Pokaż klucz do ręcznego wpisania</summary>
            <p className="mt-2 break-words font-mono text-base tracking-wider" translate="no">{secret}</p>
            <p className="mt-1 text-muted">Klucz daje dostęp do Twojego drugiego składnika. Nie zapisuj go w notatkach ani nie wysyłaj dalej.</p>
          </details>
        )}
      </div>

      <form action={confirm} className="grid max-w-xs gap-3">
        <div>
          <label htmlFor="code" className="mb-1 block text-sm">Kod z aplikacji</label>
          <input id="code" name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 \-]{6,9}" maxLength={9} className="field font-mono tracking-widest" aria-invalid={result && !result.ok ? true : undefined} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-primary" disabled={confirming}>{confirming ? "Sprawdzanie…" : "Potwierdź i włącz"}</button>
        </div>
        <ResultMessage result={result} />
      </form>

      <form action={cancelEnrollment.bind(null, factorId)}>
        <button className="link text-sm">Anuluj dodawanie</button>
      </form>
    </div>
  );
}
