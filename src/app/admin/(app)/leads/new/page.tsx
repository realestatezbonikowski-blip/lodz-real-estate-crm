import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/features/admin-prefs/server";
import { requireStaff } from "@/features/crm/auth";
import { ManualLeadForm } from "@/features/crm/components/forms";
import { listProjects } from "@/features/crm/queries";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("new.title") };
}

export default async function NewLeadPage() {
  const { supabase } = await requireStaff();
  const { t } = await getT();
  const projects = await listProjects(supabase);

  return (
    <main id="content" className="wrap py-8 lg:py-12">
      <p className="text-sm"><Link href="/admin/leads" className="link">{t("detail.all")}</Link></p>
      <h1 className="display mt-4 text-4xl sm:text-5xl">{t("new.title")}</h1>
      <p className="mt-2 max-w-xl text-muted">{t("new.intro")}</p>
      <div className="mt-8"><ManualLeadForm projects={projects.ok ? projects.data : []} /></div>
    </main>
  );
}
