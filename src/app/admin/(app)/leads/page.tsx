import type { Metadata } from "next";
import { getT } from "@/features/admin-prefs/server";
import { requireStaff } from "@/features/crm/auth";
import { LeadsView } from "@/features/crm/components/LeadsView";
import { latestContacts, listLeads, listProjects, listStaff, statusCounts } from "@/features/crm/queries";
import { parseFilters } from "@/features/crm/schema";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("leads.title") };
}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const { supabase, profile } = await requireStaff();
  const { t } = await getT();

  // Owner onboarding needs one real number: unassigned leads (any page). It does not depend on the list,
  // so it runs in the same round trip as the other reads instead of after them.
  const unassignedQuery = profile.role === "owner"
    ? supabase.from("leads").select("id", { count: "exact", head: true }).is("assigned_to", null).is("archived_at", null)
    : null;
  const [list, counts, staff, projects, unassigned] = await Promise.all([
    listLeads(supabase, filters), statusCounts(supabase, filters), listStaff(supabase), listProjects(supabase), unassignedQuery,
  ]);
  // A failed read is shown as an error, never as "no leads".
  if (!list.ok) throw new Error("leads_unavailable");
  const contacts = await latestContacts(supabase, list.data.rows.map((r) => r.id));
  // A failed count is "unknown" (null), never "zero": the onboarding hint must not claim everything is assigned.
  const unassignedTotal = unassigned && !unassigned.error && typeof unassigned.count === "number" ? unassigned.count : null;

  return (
    <LeadsView
      filters={filters}
      rows={list.data.rows}
      total={list.data.total}
      counts={counts.ok ? counts.data : null}
      staff={staff.ok ? staff.data : []}
      staffKnown={staff.ok}
      projects={projects.ok ? projects.data : []}
      me={profile.id}
      isOwner={profile.role === "owner"}
      contacts={Object.fromEntries(contacts)}
      unassignedTotal={unassignedTotal}
      notice={sp.deleted === "1" ? t("leads.deleted") : sp.error === "forbidden" ? t("leads.forbidden") : undefined}
    />
  );
}
