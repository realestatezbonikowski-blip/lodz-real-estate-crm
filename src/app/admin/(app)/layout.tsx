import Link from "next/link";
import { signOut } from "@/features/crm/actions";
import { requireStaff } from "@/features/crm/auth";
import { CrmNav, SignOutIcon } from "@/features/crm/components/CrmNav";
import { ROLE_LABELS } from "@/features/crm/labels";

export const dynamic = "force-dynamic";

const ITEMS = [
  { href: "/admin/leads", label: "Leady", icon: "leads" },
  { href: "/admin/leads/new", label: "Nowy lead", icon: "new" },
  { href: "/admin/security", label: "Bezpieczeństwo", icon: "security" },
  { href: "/admin/help", label: "Pomoc", icon: "help" },
] as const;
const TEAM_ITEM = { href: "/admin/team", label: "Zespół", icon: "team" } as const; // owners only

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireStaff();

  return (
    <>
      <a href="#content" className="absolute left-3 top-3 z-50 -translate-y-20 bg-ink px-4 py-3 text-paper focus:translate-y-0">
        Przejdź do treści
      </a>
      <header className="crm-header">
        <div className="wrap flex min-h-16 items-center justify-between gap-4">
          <Link href="/admin/leads" className="crm-brand" aria-label="CRM, strona główna panelu">
            <span aria-hidden="true" className="crm-mark" />
            <span className="display text-xl">CRM</span>
          </Link>
          <CrmNav
            items={profile.role === "owner" ? [ITEMS[0], ITEMS[1], TEAM_ITEM, ITEMS[2], ITEMS[3]] : [...ITEMS]}
            label="Panel"
            menuOpen="Otwórz menu panelu"
            menuClose="Zamknij menu panelu"
            userName={profile.full_name}
            role={ROLE_LABELS[profile.role]}
            signOut={
              <form action={signOut}>
                <button className="btn btn-ghost min-h-10 px-3 text-sm" aria-label="Wyloguj"><SignOutIcon /> Wyloguj</button>
              </form>
            }
          />
        </div>
      </header>
      {children}
    </>
  );
}
