import type { Metadata } from "next";
import Link from "next/link";
import { rich } from "@/features/admin-prefs/rich";
import { getT } from "@/features/admin-prefs/server";
import { requireStaff } from "@/features/crm/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("help.title") };
}

// A short guide that describes only what exists in this CRM: the real tabs, buttons, fields, statuses
// and permissions (see src/features/crm and the RLS policies). Update it, in both languages, when the
// workflow changes (the texts live in features/admin-prefs/dict-*.ts).

const STEPS = [
  { key: "s1", owner: true },
  { key: "s2", owner: false },
  { key: "s3", owner: true },
  { key: "s4", owner: false },
  { key: "s5", owner: false },
  { key: "s6", owner: false },
  { key: "s7", owner: false },
] as const;

export default async function HelpPage() {
  const { profile } = await requireStaff();
  const { t } = await getT();
  const owner = profile.role === "owner";
  const links = {
    team: <Link className="link" href="/admin/team">{t("nav.team")}</Link>,
    leads: <Link className="link" href="/admin/leads">{t("nav.leads")}</Link>,
    security: <Link className="link" href="/admin/security">{t("nav.security")}</Link>,
  };
  const perms = [
    [t("help.perm.p1"), t("help.perm.yes"), t("help.perm.yes")],
    [t("help.perm.p2"), t("help.perm.yes"), t("help.perm.yes")],
    [t("help.perm.p3"), t("help.perm.yes"), t("help.perm.p3agent")],
    [t("help.perm.p4"), t("help.perm.yes"), t("help.perm.yes")],
    [t("help.perm.p5"), t("help.perm.yes"), t("help.perm.no")],
    [t("help.perm.p6"), t("help.perm.yes"), t("help.perm.no")],
  ] as const;

  return (
    <main id="content" className="wrap py-8 lg:py-12">
      <h1 className="display text-4xl sm:text-5xl">{t("help.title")}</h1>
      <p className="mt-2 max-w-2xl text-muted">
        {t("help.intro")}
        {owner ? t("help.introOwner") : t("help.introAgent")}
      </p>

      <ol className="mt-8 grid gap-3 lg:grid-cols-2">
        {STEPS.map((s) => (
          <li key={s.key} className="crm-panel p-5">
            <h2 className="text-lg font-semibold">{t(`help.${s.key}.title`)}{s.owner && <span className="tag ml-2 align-middle">{t("help.ownerOnly")}</span>}</h2>
            <p className="mt-2 text-muted">{rich(t(`help.${s.key}.body`), links)}</p>
          </li>
        ))}
      </ol>

      <section aria-labelledby="perm" className="mt-10">
        <h2 id="perm" className="eyebrow">{t("help.perm.title")}</h2>

        {/* Phones: one card per action instead of a table that scrolls sideways. */}
        <ul className="mt-4 grid gap-2 sm:hidden">
          {perms.map(([action, o, a]) => (
            <li key={action} className="crm-panel p-4 text-sm">
              <p className="font-medium">{action}</p>
              <p className="mt-2 text-muted">{t("help.perm.owner")}: {o}</p>
              <p className="text-muted">{t("help.perm.agent")}: {a}</p>
            </li>
          ))}
        </ul>

        <div className="mt-4 hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border"><th scope="col" className="py-2 pr-4 font-medium">{t("help.perm.action")}</th><th scope="col" className="py-2 pr-4 font-medium">{t("help.perm.owner")}</th><th scope="col" className="py-2 font-medium">{t("help.perm.agent")}</th></tr>
            </thead>
            <tbody>
              {perms.map(([action, o, a]) => (
                <tr key={action} className="border-b border-border"><td className="py-2 pr-4">{action}</td><td className="py-2 pr-4">{o}</td><td className="py-2">{a}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-8 text-sm text-muted">{rich(t("help.security"), links)}</p>
    </main>
  );
}
