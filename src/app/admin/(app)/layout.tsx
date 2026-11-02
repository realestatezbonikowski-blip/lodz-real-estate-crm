import Link from "next/link";
import { SubmitButton } from "@/components/SubmitButton";
import { AdminPrefs } from "@/features/admin-prefs/controls";
import { getT } from "@/features/admin-prefs/server";
import { signOut } from "@/features/crm/actions";
import { requireStaff } from "@/features/crm/auth";
import { CrmNav, SignOutIcon } from "@/features/crm/components/CrmNav";
import { roleLabel } from "@/features/crm/labels";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireStaff();
  const { t } = await getT();

  const leads = { href: "/admin/leads", label: t("nav.leads"), icon: "leads" } as const;
  const create = { href: "/admin/leads/new", label: t("nav.new"), icon: "new" } as const;
  const security = { href: "/admin/security", label: t("nav.security"), icon: "security" } as const;
  const help = { href: "/admin/help", label: t("nav.help"), icon: "help" } as const;
  const team = { href: "/admin/team", label: t("nav.team"), icon: "team" } as const; // owners only

  return (
    <>
      <a href="#content" className="absolute left-3 top-3 z-50 -translate-y-20 bg-ink px-4 py-3 text-paper focus:translate-y-0">
        {t("common.skip")}
      </a>
      <header className="crm-header">
        <div className="wrap flex min-h-16 items-center justify-between gap-2 sm:gap-4">
          <Link href="/admin/leads" className="crm-brand" aria-label={t("nav.home")}>
            <span aria-hidden="true" className="crm-mark" />
            <span className="display text-xl">CRM</span>
          </Link>
          <CrmNav
            items={profile.role === "owner" ? [leads, create, team, security, help] : [leads, create, security, help]}
            label={t("nav.panel")}
            menuOpen={t("nav.menuOpen")}
            menuClose={t("nav.menuClose")}
            userName={profile.full_name}
            role={roleLabel(t, profile.role)}
            prefs={<AdminPrefs />}
            signOut={
              <form action={signOut}>
                <SubmitButton pendingLabel={t("common.working")} className="btn btn-ghost min-h-11 px-3 text-sm" aria-label={t("nav.signOut")}>
                  <SignOutIcon /> {t("nav.signOut")}
                </SubmitButton>
              </form>
            }
          />
        </div>
      </header>
      {children}
    </>
  );
}
