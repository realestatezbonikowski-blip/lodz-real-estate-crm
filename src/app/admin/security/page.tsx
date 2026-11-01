import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/features/crm/actions";
import { dateTime } from "@/features/crm/labels";
import { CancelPending, RemoveFactor } from "@/features/mfa/components/FactorActions";
import { EnrollPanel } from "@/features/mfa/components/EnrollPanel";
import { requireMfaSession } from "@/features/mfa/session";

export const metadata: Metadata = { title: "Bezpieczeństwo konta" };
export const dynamic = "force-dynamic";

const MAX_FACTORS = 10; // the project's limit (Dashboard, verified); the Auth server enforces it

// Account security. Like /admin/mfa it needs only a server-validated session and reads no application
// table, so it stays reachable for an aal1 session whatever the database policies later require.
export default async function SecurityPage() {
  const { state } = await requireMfaSession();
  const verified = state.factors.filter((f) => f.status === "verified");
  const pending = state.factors.filter((f) => f.status === "unverified");
  const verifiers = state.verifiedTotp.map((f) => ({ id: f.id, name: f.friendlyName }));

  const sessionText =
    state.currentLevel === "aal2" ? "zweryfikowana kodem z aplikacji (aal2)" :
    state.currentLevel === "aal1" ? "tylko hasło (aal1)" :
    "poziom nieznany. Wyloguj się i zaloguj ponownie";

  return (
    <>
      <header className="border-b border-border">
        <div className="wrap flex min-h-16 flex-wrap items-center justify-between gap-4 py-2">
          <Link href="/admin/leads" className="display text-2xl">CRM</Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/admin/leads" className="inline-flex min-h-11 items-center hover:underline">← Leady</Link>
            <form action={signOut}><button className="btn btn-ghost">Wyloguj</button></form>
          </div>
        </div>
      </header>

      <main id="content" className="wrap py-8 lg:py-12">
        <h1 className="display text-4xl sm:text-5xl">Bezpieczeństwo konta</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Uwierzytelnianie dwuskładnikowe (TOTP) chroni konto także wtedy, gdy hasło wycieknie. <strong>Nie jest jeszcze wymagane</strong>: możesz je skonfigurować i przetestować teraz, a logowanie hasłem nadal działa bez zmian.
        </p>

        <section aria-labelledby="status" className="card mt-8 max-w-2xl p-5">
          <h2 id="status" className="eyebrow">Stan</h2>
          <dl className="mt-3 grid gap-3 text-sm">
            {state.email && <div><dt className="text-muted">Konto</dt><dd>{state.email}</dd></div>}
            <div><dt className="text-muted">Drugi składnik</dt><dd>{verified.length > 0 ? `skonfigurowany (${verified.length})` : "nie skonfigurowany"}</dd></div>
            <div><dt className="text-muted">Ta sesja</dt><dd>{sessionText}</dd></div>
          </dl>
          {state.hasVerifiedFactor && state.currentLevel !== "aal2" && (
            <p className="mt-4"><Link href="/admin/mfa?next=/admin/security" className="btn btn-primary">Zweryfikuj tę sesję kodem</Link></p>
          )}
        </section>

        <section aria-labelledby="factors" className="mt-10 max-w-2xl">
          <h2 id="factors" className="eyebrow">Skonfigurowane aplikacje</h2>
          {state.factors.length === 0 ? (
            <p className="mt-3 text-muted">Brak. Dodaj pierwszą aplikację poniżej.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border border-y border-border">
              {verified.map((f) => (
                <li key={f.id} className="grid gap-2 py-4">
                  <p><span className="font-medium">{f.friendlyName}</span> <span className="tag ml-2">aktywna</span></p>
                  <p className="text-sm text-muted">Dodana: {f.createdAt ? dateTime(f.createdAt) : "—"}</p>
                  <RemoveFactor factorId={f.id} isLast={verified.length === 1} verifiers={verifiers} />
                </li>
              ))}
              {pending.map((f) => (
                <li key={f.id} className="grid gap-2 py-4">
                  <p><span className="font-medium">{f.friendlyName}</span> <span className="tag ml-2">nieukończona</span></p>
                  <p className="text-sm text-muted">Dodawanie nie zostało potwierdzone kodem, więc ta aplikacja jeszcze nie chroni konta.</p>
                  <CancelPending factorId={f.id} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="add" className="mt-10">
          <h2 id="add" className="eyebrow">Dodaj aplikację uwierzytelniającą</h2>
          {state.factors.length >= MAX_FACTORS ? (
            <p className="mt-3 text-muted">Osiągnięto limit {MAX_FACTORS} aplikacji. Usuń nieużywaną, aby dodać nową.</p>
          ) : (
            <div className="mt-4"><EnrollPanel /></div>
          )}
          {verified.length === 1 && (
            <p className="mt-6 max-w-2xl text-sm text-muted">Zalecenie: dodaj drugą aplikację na innym urządzeniu jako kopię zapasową. To jedyny sposób na dostęp po utracie telefonu, który nie wymaga pomocy administratora.</p>
          )}
        </section>

        <section aria-labelledby="lost" className="mt-12 max-w-2xl border-t border-border pt-6">
          <h2 id="lost" className="eyebrow">Utrata dostępu do aplikacji</h2>
          <p className="mt-3 text-sm text-muted">
            Kody odzyskiwania nie są dostępne w tym panelu. Jeśli masz drugą aplikację, użyj jej i usuń utraconą. Jeśli nie, skontaktuj się z administratorem projektu: usunięcie składnika wymaga ręcznej interwencji i potwierdzenia tożsamości poza aplikacją. Nie ma sposobu na obejście tego w panelu, i tak ma być.
          </p>
        </section>
      </main>
    </>
  );
}
