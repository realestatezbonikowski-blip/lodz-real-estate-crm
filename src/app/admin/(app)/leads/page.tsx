import type { Metadata } from "next";
import { requireStaff } from "@/features/crm/auth";
import { LeadsView } from "@/features/crm/components/LeadsView";
import { latestContacts, listLeads, listProjects, listStaff, statusCounts } from "@/features/crm/queries";
import { parseFilters } from "@/features/crm/schema";

export const metadata: Metadata = { title: "Leady" };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const { supabase, profile } = await requireStaff();

  const [list, counts, staff, projects] = await Promise.all([
    listLeads(supabase, filters), statusCounts(supabase, filters), listStaff(supabase), listProjects(supabase),
  ]);
  // A failed read is shown as an error, never as "no leads".
  if (!list.ok) throw new Error("leads_unavailable");
  const contacts = await latestContacts(supabase, list.data.rows.map((r) => r.id));
  // Owner onboarding needs two real numbers: unassigned leads (any page) and whether an opiekun exists.
  const unassigned = profile.role === "owner" ? await supabase.from("leads").select("id", { count: "exact", head: true }).is("assigned_to", null).is("archived_at", null) : null;

  return (
    <LeadsView
      filters={filters}
      rows={list.data.rows}
      total={list.data.total}
      counts={counts.ok ? counts.data : null}
      staff={staff.ok ? staff.data : []}
      projects={projects.ok ? projects.data : []}
      me={profile.id}
      isOwner={profile.role === "owner"}
      contacts={Object.fromEntries(contacts)}
      unassignedTotal={unassigned?.count ?? null}
      notice={sp.deleted === "1" ? "Lead został usunięty." : sp.error === "forbidden" ? "Ta czynność wymaga uprawnień właściciela." : undefined}
    />
  );
}
