import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/features/crm/auth";
import { LeadDetailView } from "@/features/crm/components/LeadDetailView";
import { getLead, listActivities, listStaff } from "@/features/crm/queries";

export const metadata: Metadata = { title: "Lead" };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { supabase, profile } = await requireStaff();

  const [lead, activities, staff] = await Promise.all([getLead(supabase, id), listActivities(supabase, id), listStaff(supabase)]);
  if (!lead.ok) throw new Error("lead_unavailable");
  if (!lead.data) notFound(); // missing, or hidden by RLS

  return (
    <LeadDetailView
      lead={lead.data}
      activities={activities.ok ? activities.data : null}
      staff={staff.ok ? staff.data : []}
      isOwner={profile.role === "owner"}
    />
  );
}
