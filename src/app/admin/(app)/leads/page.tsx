import type { Metadata } from "next";
import { requireStaff } from "@/features/crm/auth";
import { LeadsView } from "@/features/crm/components/LeadsView";
import { listLeads, listProjects, listStaff, statusCounts } from "@/features/crm/queries";
import { parseFilters } from "@/features/crm/schema";

export const metadata: Metadata = { title: "Leady" };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const { supabase } = await requireStaff();

  const [list, counts, staff, projects] = await Promise.all([
    listLeads(supabase, filters), statusCounts(supabase, filters), listStaff(supabase), listProjects(supabase),
  ]);
  // A failed read is shown as an error, never as "no leads".
  if (!list.ok) throw new Error("leads_unavailable");

  return (
    <LeadsView
      filters={filters}
      rows={list.data.rows}
      total={list.data.total}
      counts={counts.ok ? counts.data : null}
      staff={staff.ok ? staff.data : []}
      projects={projects.ok ? projects.data : []}
      notice={sp.deleted === "1" ? "Lead został usunięty." : sp.error === "forbidden" ? "Ta czynność wymaga uprawnień właściciela." : undefined}
    />
  );
}
