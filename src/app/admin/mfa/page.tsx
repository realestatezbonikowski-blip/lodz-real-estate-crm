import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChallengeForm } from "@/features/mfa/components/ChallengeForm";
import { safeNext } from "@/features/mfa/policy";
import { requireMfaSession } from "@/features/mfa/session";

export const metadata: Metadata = { title: "Weryfikacja dwuskładnikowa" };
export const dynamic = "force-dynamic";

// The challenge screen. It reads no application table: only the Auth server's view of the session.
// It never redirects to itself, to the login page or to the security page in a way that can loop:
//   already aal2          -> straight on to the (validated) target
//   no verified factor    -> /admin/security (nothing to challenge; a pending, unverified factor does not count)
//   otherwise             -> show the form
export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = safeNext(next);
  const { state } = await requireMfaSession();

  if (state.currentLevel === "aal2") redirect(target);
  if (state.verifiedTotp.length === 0) redirect("/admin/security");

  return (
    <main id="content" className="wrap grid min-h-screen content-center py-12">
      <div className="mx-auto w-full max-w-sm">
        <p className="eyebrow">Panel administracyjny</p>
        <h1 className="display mt-3 text-4xl">Weryfikacja dwuskładnikowa</h1>
        <p className="mt-3 text-muted">Wpisz kod z aplikacji uwierzytelniającej, aby potwierdzić tę sesję.</p>
        <ChallengeForm next={target} factors={state.verifiedTotp.map((f) => ({ id: f.id, name: f.friendlyName }))} />
        <p className="mt-8 text-sm text-muted">
          Nie masz dostępu do aplikacji? Użyj drugiego urządzenia, jeśli je dodałeś(-aś). W przeciwnym razie skontaktuj się z administratorem projektu: odzyskanie dostępu wymaga ręcznej interwencji i potwierdzenia tożsamości poza aplikacją.
        </p>
        <p className="mt-4 text-sm"><Link href="/admin/security" className="link">Ustawienia bezpieczeństwa</Link></p>
      </div>
    </main>
  );
}
