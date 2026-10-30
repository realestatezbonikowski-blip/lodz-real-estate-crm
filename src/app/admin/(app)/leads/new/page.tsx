import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/features/crm/auth";
import { ManualLeadForm } from "@/features/crm/components/forms";
import { listProjects } from "@/features/crm/queries";

export const metadata: Metadata = { title: "Nowy lead" };

export default async function NewLeadPage() {
  const { supabase } = await requireStaff();
  const projects = await listProjects(supabase);

  return (
    <main id="content" className="wrap py-8 lg:py-12">
      <p className="text-sm"><Link href="/admin/leads" className="link">← Wszystkie leady</Link></p>
      <h1 className="display mt-4 text-4xl sm:text-5xl">Nowy lead</h1>
      <p className="mt-2 max-w-xl text-muted">Dodaj zapytanie, które wpłynęło inną drogą niż formularz, na przykład telefonicznie.</p>
      <div className="mt-8"><ManualLeadForm projects={projects.ok ? projects.data : []} /></div>
    </main>
  );
}
