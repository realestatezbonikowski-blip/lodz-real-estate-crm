import type { Metadata } from "next";
import Link from "next/link";
import { SubmitButton } from "@/components/SubmitButton";
import { AdminPrefs } from "@/features/admin-prefs/controls";
import { getT } from "@/features/admin-prefs/server";
import { signOut } from "@/features/crm/actions";
import { dateTime } from "@/features/crm/labels";
import { CancelPending, RemoveFactor } from "@/features/mfa/components/FactorActions";
import { EnrollPanel } from "@/features/mfa/components/EnrollPanel";
import { requireMfaSession } from "@/features/mfa/session";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("sec.title") };
}
export const dynamic = "force-dynamic";

const MAX_FACTORS = 10; // the project's limit (Dashboard, verified); the Auth server enforces it

// Account security. Like /admin/mfa it needs only a server-validated session and reads no application
// table, so it stays reachable for an aal1 session whatever the database policies later require.
export default async function SecurityPage() {
  const { state } = await requireMfaSession();
  const { t, lang } = await getT();
  const verified = state.factors.filter((f) => f.status === "verified");
  const pending = state.factors.filter((f) => f.status === "unverified");
  const verifiers = state.verifiedTotp.map((f) => ({ id: f.id, name: f.friendlyName }));

  const sessionText =
    state.currentLevel === "aal2" ? t("sec.aal2") :
    state.currentLevel === "aal1" ? t("sec.aal1") :
    t("sec.aalUnknown");

  return (
    <>
      <header className="border-b border-border">
        <div className="wrap flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
          <Link href="/admin/leads" className="display text-2xl">CRM</Link>
          <div className="flex items-center gap-2 text-sm sm:gap-4">
            <AdminPrefs />
            <Link href="/admin/leads" className="inline-flex min-h-11 items-center hover:underline">{t("sec.back")}</Link>
            <form action={signOut}><SubmitButton className="btn btn-ghost" pendingLabel={t("common.working")}>{t("nav.signOut")}</SubmitButton></form>
          </div>
        </div>
      </header>

      <main id="content" className="wrap py-8 lg:py-12">
        <h1 className="display text-4xl sm:text-5xl">{t("sec.title")}</h1>
        <p className="mt-2 max-w-2xl text-muted">
          {t("sec.introA")}<strong>{t("sec.introB")}</strong>{t("sec.introC")}
        </p>

        <section aria-labelledby="status" className="card mt-8 max-w-2xl p-5">
          <h2 id="status" className="eyebrow">{t("sec.state")}</h2>
          <dl className="mt-3 grid gap-3 text-sm">
            {state.email && <div><dt className="text-muted">{t("sec.account")}</dt><dd className="break-all">{state.email}</dd></div>}
            <div><dt className="text-muted">{t("sec.second")}</dt><dd>{verified.length > 0 ? t("sec.configured", { n: verified.length }) : t("sec.notConfigured")}</dd></div>
            <div><dt className="text-muted">{t("sec.session")}</dt><dd>{sessionText}</dd></div>
          </dl>
          {state.hasVerifiedFactor && state.currentLevel !== "aal2" && (
            <p className="mt-4"><Link href="/admin/mfa?next=/admin/security" className="btn btn-primary">{t("sec.verifySession")}</Link></p>
          )}
        </section>

        <section aria-labelledby="factors" className="mt-10 max-w-2xl">
          <h2 id="factors" className="eyebrow">{t("sec.apps")}</h2>
          {state.factors.length === 0 ? (
            <p className="mt-3 text-muted">{t("sec.none")}</p>
          ) : (
            <ul className="mt-3 divide-y divide-border border-y border-border">
              {verified.map((f) => (
                <li key={f.id} className="grid gap-2 py-4">
                  <p><span className="font-medium">{f.friendlyName}</span> <span className="tag ml-2">{t("sec.active")}</span></p>
                  <p className="text-sm text-muted">{t("sec.added", { date: f.createdAt ? dateTime(f.createdAt, lang) : "—" })}</p>
                  <RemoveFactor factorId={f.id} isLast={verified.length === 1} verifiers={verifiers} />
                </li>
              ))}
              {pending.map((f) => (
                <li key={f.id} className="grid gap-2 py-4">
                  <p><span className="font-medium">{f.friendlyName}</span> <span className="tag ml-2">{t("sec.pending")}</span></p>
                  <p className="text-sm text-muted">{t("sec.pendingText")}</p>
                  <CancelPending factorId={f.id} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="add" className="mt-10">
          <h2 id="add" className="eyebrow">{t("sec.addTitle")}</h2>
          {state.factors.length >= MAX_FACTORS ? (
            <p className="mt-3 text-muted">{t("sec.limit", { n: MAX_FACTORS })}</p>
          ) : (
            <div className="mt-4"><EnrollPanel /></div>
          )}
          {verified.length === 1 && (
            <p className="mt-6 max-w-2xl text-sm text-muted">{t("sec.recommend")}</p>
          )}
        </section>

        <section aria-labelledby="lost" className="mt-12 max-w-2xl border-t border-border pt-6">
          <h2 id="lost" className="eyebrow">{t("sec.lostTitle")}</h2>
          <p className="mt-3 text-sm text-muted">{t("sec.lostText")}</p>
        </section>
      </main>
    </>
  );
}
