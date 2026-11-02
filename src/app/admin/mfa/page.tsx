import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPrefs } from "@/features/admin-prefs/controls";
import { getT } from "@/features/admin-prefs/server";
import { ChallengeForm } from "@/features/mfa/components/ChallengeForm";
import { safeNext } from "@/features/mfa/policy";
import { requireMfaSession } from "@/features/mfa/session";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("mfa.title") };
}
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
  const { t } = await getT();

  return (
    <main id="content" className="wrap relative grid min-h-dvh content-center py-12">
      <div className="absolute right-4 top-4"><AdminPrefs /></div>
      <div className="mx-auto w-full max-w-sm">
        <p className="eyebrow">{t("common.panel")}</p>
        <h1 className="display mt-3 text-4xl">{t("mfa.title")}</h1>
        <p className="mt-3 text-muted">{t("mfa.intro")}</p>
        <ChallengeForm next={target} factors={state.verifiedTotp.map((f) => ({ id: f.id, name: f.friendlyName }))} />
        <p className="mt-8 text-sm text-muted">{t("mfa.noAccess")}</p>
        <p className="mt-4 text-sm"><Link href="/admin/security" className="link inline-flex min-h-11 items-center">{t("mfa.settings")}</Link></p>
      </div>
    </main>
  );
}
