// Read queries for the CRM. They run as the signed-in staff member (publishable key + session), so
// RLS decides what comes back; nothing here widens access. Every function reports failure instead
// of throwing so pages can show an error state.
import type { SupabaseClient } from "@supabase/supabase-js";
import { LEAD_STATUSES, PAGE_SIZE, searchWords, todayWarsaw, type LeadFilters, type LeadStatus } from "./schema.ts";

export type LeadListItem = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  status: LeadStatus;
  source: "web_form" | "manual";
  assigned_to: string | null;
  created_at: string;
  archived_at: string | null;
  projects: { name: string } | null;
  /** Follow-up planning (migration 20261101090000). Absent/null while the columns do not exist yet. */
  follow_up_on?: string | null;
  next_action?: string | null;
};

export type LeadDetail = LeadListItem & {
  message: string | null;
  locale: string;
  project_id: string | null;
  created_by: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  landing_path: string | null;
  referrer: string | null;
  privacy_notice_version: string | null;
  updated_at: string;
};

export type Activity = {
  id: string;
  type: "note" | "call" | "email" | "meeting" | "status_change";
  body: string | null;
  from_status: LeadStatus | null;
  to_status: LeadStatus | null;
  occurred_at: string;
  actor_id: string | null;
};

export type StaffMember = { id: string; full_name: string; role: "owner" | "assistant"; is_active: boolean };
export type ProjectOption = { id: string; name: string; is_active: boolean };

export type Result<T> = { ok: true; data: T } | { ok: false };

type Filterable = {
  eq(column: string, value: string): Filterable;
  is(column: string, value: null): Filterable;
  lte(column: string, value: string): Filterable;
  or(filters: string): Filterable;
};

function applyFilters<T>(query: T, f: LeadFilters, opts: { skipStatus?: boolean } = {}): T {
  let q = query as unknown as Filterable;
  if (!opts.skipStatus && f.status) q = q.eq("status", f.status);
  if (f.project) q = q.eq("project_id", f.project);
  if (f.source) q = q.eq("source", f.source);
  if (f.assigned === "none") q = q.is("assigned_to", null);
  else if (f.assigned) q = q.eq("assigned_to", f.assigned);
  if (f.followUp === "due") q = q.lte("follow_up_on", todayWarsaw());
  if (!f.includeArchived) q = q.is("archived_at", null);
  // One .or() per word, so "jan kow" requires both words (AND) and each word may match any column.
  // Words contain only letters, digits and "@ . + - _" (see sanitizeSearch), so they cannot inject filters.
  for (const w of searchWords(f.q ?? "")) {
    q = q.or(`first_name.ilike.%${w}%,last_name.ilike.%${w}%,email.ilike.%${w}%,phone.ilike.%${w}%`);
  }
  return q as unknown as T;
}

const BASE_COLUMNS = "id, first_name, last_name, phone, email, status, source, assigned_to, created_at, archived_at, projects(name)";
const LIST_COLUMNS = `${BASE_COLUMNS}, follow_up_on, next_action`;
/** Postgres "undefined_column": the follow-up migration has not been applied to this database yet. */
const missingColumn = (e: { code?: string } | null) => e?.code === "42703" || e?.code === "PGRST204";

export async function listLeads(db: SupabaseClient, f: LeadFilters): Promise<Result<{ rows: LeadListItem[]; total: number }>> {
  const from = (f.page - 1) * PAGE_SIZE;
  const run = (cols: string, ff: LeadFilters) =>
    applyFilters(db.from("leads").select(cols, { count: "exact" }), ff).order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  let { data, count, error } = await run(LIST_COLUMNS, f);
  // Migration not applied yet: show the list without follow-up data (and ignore the follow-up filter).
  if (error && missingColumn(error)) ({ data, count, error } = await run(BASE_COLUMNS, { ...f, followUp: undefined }));
  if (error) return { ok: false };
  return { ok: true, data: { rows: (data ?? []) as unknown as LeadListItem[], total: count ?? 0 } };
}

/** Lead counts per status for the chips; the status filter itself is ignored so every chip shows its own total. */
export async function statusCounts(db: SupabaseClient, f: LeadFilters): Promise<Result<Record<LeadStatus, number>>> {
  const results = await Promise.all(
    LEAD_STATUSES.map((s) => applyFilters(db.from("leads").select("id", { count: "exact", head: true }), f, { skipStatus: true }).eq("status", s)),
  );
  if (results.some((r) => r.error)) return { ok: false };
  return { ok: true, data: Object.fromEntries(LEAD_STATUSES.map((s, i) => [s, results[i]?.count ?? 0])) as Record<LeadStatus, number> };
}

export async function getLead(db: SupabaseClient, id: string): Promise<Result<LeadDetail | null>> {
  const extra = "message, locale, project_id, created_by, utm_source, utm_medium, utm_campaign, landing_path, referrer, privacy_notice_version, updated_at";
  const run = (list: string) => db.from("leads").select(`${list}, ${extra}`).eq("id", id).maybeSingle();
  let { data, error } = await run(LIST_COLUMNS);
  if (error && missingColumn(error)) ({ data, error } = await run(BASE_COLUMNS)); // follow-up migration not applied yet
  if (error) return { ok: false };
  return { ok: true, data: (data as unknown as LeadDetail | null) ?? null };
}

export type LatestContact = { type: Exclude<Activity["type"], "status_change">; occurred_at: string };

/** The most recent real contact (note, call, e-mail, meeting) per lead, for the leads on the current page only. */
export async function latestContacts(db: SupabaseClient, leadIds: string[]): Promise<Map<string, LatestContact>> {
  const out = new Map<string, LatestContact>();
  if (leadIds.length === 0) return out;
  const { data } = await db
    .from("lead_activities")
    .select("lead_id, type, occurred_at")
    .in("lead_id", leadIds)
    .in("type", ["note", "call", "email", "meeting"])
    .order("occurred_at", { ascending: false })
    .limit(500);
  for (const r of (data ?? []) as { lead_id: string; type: LatestContact["type"]; occurred_at: string }[]) {
    if (!out.has(r.lead_id)) out.set(r.lead_id, { type: r.type, occurred_at: r.occurred_at });
  }
  return out;
}

export async function listActivities(db: SupabaseClient, leadId: string): Promise<Result<Activity[]>> {
  const { data, error } = await db
    .from("lead_activities")
    .select("id, type, body, from_status, to_status, occurred_at, actor_id")
    .eq("lead_id", leadId)
    .order("occurred_at", { ascending: false })
    .limit(200);
  if (error) return { ok: false };
  return { ok: true, data: (data ?? []) as Activity[] };
}

export async function listStaff(db: SupabaseClient): Promise<Result<StaffMember[]>> {
  const { data, error } = await db.from("profiles").select("id, full_name, role, is_active").order("full_name");
  if (error) return { ok: false };
  return { ok: true, data: (data ?? []) as StaffMember[] };
}

export async function listProjects(db: SupabaseClient): Promise<Result<ProjectOption[]>> {
  const { data, error } = await db.from("projects").select("id, name, is_active").order("name");
  if (error) return { ok: false };
  return { ok: true, data: (data ?? []) as ProjectOption[] };
}
