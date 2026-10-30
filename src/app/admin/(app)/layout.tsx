import Link from "next/link";
import { signOut } from "@/features/crm/actions";
import { requireStaff } from "@/features/crm/auth";
import { ROLE_LABELS } from "@/features/crm/labels";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireStaff();

  return (
    <>
      <a href="#content" className="absolute left-3 top-3 z-50 -translate-y-20 bg-ink px-4 py-3 text-paper focus:translate-y-0">
        Przejdź do treści
      </a>
      <header className="border-b border-border">
        <div className="wrap flex min-h-16 flex-wrap items-center justify-between gap-x-6 gap-y-2 py-2">
          <div className="flex items-center gap-8">
            <Link href="/admin/leads" className="display text-2xl">CRM</Link>
            <nav aria-label="Panel" className="flex gap-6 text-sm">
              <Link href="/admin/leads" className="inline-flex min-h-11 items-center hover:underline">Leady</Link>
              <Link href="/admin/leads/new" className="inline-flex min-h-11 items-center hover:underline">Nowy lead</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span>
              {profile.full_name} <span className="tag ml-1">{ROLE_LABELS[profile.role]}</span>
            </span>
            <form action={signOut}><button className="btn btn-ghost">Wyloguj</button></form>
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
