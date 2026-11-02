import { CalendarCheck, CircleCheck, CircleDot, Users } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { rich } from "@/features/admin-prefs/rich";
import { getT } from "@/features/admin-prefs/server";
import { activityLabel, dateTime, sourceLabel, statusLabel } from "../labels";
import type { LatestContact, LeadListItem, ProjectOption, StaffMember } from "../queries";
import { followUpState, LEAD_STATUSES, listHref, PAGE_SIZE, todayWarsaw, type LeadFilters, type LeadStatus } from "../schema";
import { ActiveTabScroll } from "./ActiveTabScroll";
import { LinkPending } from "./CrmNav";
import { StatusBadge } from "./StatusBadge";

type Props = {
  filters: LeadFilters;
  rows: LeadListItem[];
  total: number;
  counts: Record<LeadStatus, number> | null;
  staff: StaffMember[];
  /** False when the team list could not be loaded: then the onboarding panel is hidden instead of guessing. */
  staffKnown: boolean;
  projects: ProjectOption[];
  notice?: string;
  me: string;
  isOwner: boolean;
  contacts: Record<string, LatestContact>;
  /** Unassigned, non-archived leads in the whole database (owner only; null for an opiekun). */
  unassignedTotal: number | null;
};

export async function LeadsView({ filters: f, rows, total, counts, staff, staffKnown, projects, notice, me, isOwner, contacts, unassignedTotal }: Props) {
  const { t, tn, lang } = await getT();
  const today = todayWarsaw();
  const hasOpiekun = staff.some((s) => s.role === "assistant" && s.is_active);
  const showStart = isOwner && staffKnown && (!hasOpiekun || (unassignedTotal ?? 0) > 0);
  const staffName = new Map(staff.map((s) => [s.id, s.full_name]));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(f.q || f.status || f.project || f.source || f.assigned || f.followUp || f.includeArchived);
  const allCount = counts ? LEAD_STATUSES.reduce((n, s) => n + counts[s], 0) : 0;

  return (
    <main id="content" className="wrap py-8 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl sm:text-5xl">{t("leads.title")}</h1>
          <p className="mt-1 text-sm text-muted" aria-live="polite">
            {total === 0 ? t("leads.noResults") : tn("leads.count", total)}
            {filtered && t("leads.filtersActive")}
          </p>
        </div>
        <Link href="/admin/leads/new" className="btn btn-primary">{t("nav.new")}</Link>
      </div>

      {notice && <p role="status" className="mt-4 border border-border bg-paper-deep p-3 text-sm">{notice}</p>}

      {showStart && (
        <section aria-labelledby="start" className="crm-panel mt-6 p-5">
          <h2 id="start" className="eyebrow">{t("leads.start.title")}</h2>
          <ol className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <li className="flex items-start gap-3">
              <span className={`tag ${hasOpiekun ? "tone-success" : "tone-warning"}`}>{hasOpiekun ? t("leads.start.done") : t("leads.start.todo")}</span>
              <span>{hasOpiekun ? t("leads.start.hasAgent") : rich(t("leads.start.addAgent"), { team: <Link className="link" href="/admin/team">{t("nav.team")}</Link> })}</span>
            </li>
            {unassignedTotal !== null && (
            <li className="flex items-start gap-3">
              <span className={`tag ${unassignedTotal === 0 ? "tone-success" : "tone-warning"}`}>{unassignedTotal === 0 ? t("leads.start.done") : t("leads.start.toAssign", { n: unassignedTotal })}</span>
              <span>
                {unassignedTotal === 0
                  ? t("leads.start.allAssigned")
                  : rich(t("leads.start.assign"), { list: <Link className="link" href="/admin/leads?assigned=none">{t("leads.start.unassignedList")}</Link> })}
              </span>
            </li>
            )}
          </ol>
          <p className="mt-3 text-sm text-muted">{rich(t("leads.start.help"), { help: <Link className="link" href="/admin/help">{t("nav.help")}</Link> })}</p>
        </section>
      )}

      <nav aria-label={t("leads.viewsAria")} className="mt-6 flex flex-wrap gap-2">
        <Link href={listHref(f, { assigned: me, followup: undefined })} aria-current={f.assigned === me ? "true" : undefined} className="crm-tab text-sm">{t("leads.view.mine")}<LinkPending /></Link>
        <Link href={listHref(f, { assigned: "none", followup: undefined })} aria-current={f.assigned === "none" ? "true" : undefined} className="crm-tab text-sm">{t("leads.view.unassigned")}<LinkPending /></Link>
        <Link href={listHref(f, { followup: f.followUp ? undefined : "due" })} aria-current={f.followUp ? "true" : undefined} className="crm-tab text-sm">{t("leads.view.due")}<LinkPending /></Link>
      </nav>

      {counts && (
        <section aria-label={t("leads.summaryAria")} className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {([
            { label: t("common.all"), value: allCount, status: undefined, Icon: Users },
            { label: t("leads.kpi.new"), value: counts.new, status: "new", Icon: CircleDot },
            { label: t("leads.kpi.meetings"), value: counts.meeting, status: "meeting", Icon: CalendarCheck },
            { label: t("leads.kpi.converted"), value: counts.converted, status: "converted", Icon: CircleCheck },
          ] as const).map((k) => (
            <Link key={k.status ?? "all"} href={listHref(f, { status: k.status })} className="kpi">
              <k.Icon size={18} strokeWidth={1.75} aria-hidden="true" className="kpi-icon" />
              <span className="kpi-value">{k.value}</span>
              <span className="kpi-label">{k.label}</span>
            </Link>
          ))}
        </section>
      )}

      {counts && (
        <nav aria-label={t("leads.statusAria")} className="mt-4 flex gap-2 overflow-x-auto pb-1 md:flex-wrap">
          <ActiveTabScroll />
          <Link href={listHref(f, { status: undefined })} aria-current={!f.status ? "true" : undefined}
            className="crm-tab shrink-0 text-sm">
            {t("common.all")} <span className="ml-1 text-xs opacity-80">{allCount}</span><LinkPending />
          </Link>
          {LEAD_STATUSES.map((s) => (
            <Link key={s} href={listHref(f, { status: s })} aria-current={f.status === s ? "true" : undefined}
              className="crm-tab shrink-0 text-sm">
              {statusLabel(t, s)} <span className="ml-1 text-xs opacity-80">{counts[s]}</span><LinkPending />
            </Link>
          ))}
        </nav>
      )}

      {/* next/form: a GET form that navigates on the client (no full page reload) and shows the loading skeleton. */}
      <Form action="/admin/leads" className="crm-panel mt-6 grid gap-3 p-4 md:grid-cols-6" role="search" aria-label={t("leads.searchAria")}>
        {f.status && <input type="hidden" name="status" value={f.status} />}
        {f.followUp && <input type="hidden" name="followup" value="due" />}
        <div className="md:col-span-2">
          <label htmlFor="q" className="mb-1 block text-sm">{t("leads.filter.search")}</label>
          <input id="q" name="q" type="search" enterKeyHint="search" autoCapitalize="none" autoCorrect="off" spellCheck={false} defaultValue={f.q} placeholder={t("leads.filter.searchPh")} maxLength={80} className="field" />
        </div>
        <div>
          <label htmlFor="project" className="mb-1 block text-sm">{t("leads.filter.project")}</label>
          <select id="project" name="project" defaultValue={f.project ?? ""} className="field">
            <option value="">{t("common.all")}</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="source" className="mb-1 block text-sm">{t("leads.filter.source")}</label>
          <select id="source" name="source" defaultValue={f.source ?? ""} className="field">
            <option value="">{t("common.all")}</option>
            <option value="web_form">{sourceLabel(t, "web_form")}</option>
            <option value="manual">{sourceLabel(t, "manual")}</option>
          </select>
        </div>
        <div>
          <label htmlFor="assigned" className="mb-1 block text-sm">{t("leads.filter.assigned")}</label>
          <select id="assigned" name="assigned" defaultValue={f.assigned ?? ""} className="field">
            <option value="">{t("leads.filter.everyone")}</option>
            <option value="none">{t("leads.filter.unassigned")}</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="archived" value="1" defaultChecked={f.includeArchived} className="check" /> {t("leads.filter.archived")}
          </label>
        </div>
        <div className="flex gap-2 md:col-span-6">
          <button className="btn btn-primary">{t("leads.filter.apply")}</button>
          {filtered && <Link href="/admin/leads" className="btn btn-ghost">{t("leads.filter.clear")}</Link>}
        </div>
      </Form>

      {rows.length === 0 ? (
        <div className="mt-8 border border-dashed border-border p-10 text-center">
          <p className="display text-3xl">{filtered ? t("leads.empty.filtered") : t("leads.empty")}</p>
          <p className="mt-2 text-muted">{filtered ? t("leads.empty.filteredText") : t("leads.empty.text")}</p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-2">
          {rows.map((l) => {
            const state = l.follow_up_on ? followUpState(l.follow_up_on, today) : null;
            const last = contacts[l.id];
            return (
              <li key={l.id}>
                <Link href={`/admin/leads/${l.id}`} className="lead-row grid gap-x-6 gap-y-1 md:grid-cols-12 md:items-center">
                  <span className="md:col-span-3">
                    <span className="block font-medium">{l.first_name} {l.last_name}</span>
                    <span className="block text-sm text-muted">{l.projects?.name ?? t("leads.general")}</span>
                  </span>
                  <span className="text-sm md:col-span-3">
                    <span className="block">{l.phone}</span>
                    <span className="block break-all text-muted">{l.email}</span>
                  </span>
                  <span className="mt-1 md:col-span-2 md:mt-0"><StatusBadge status={l.status} label={statusLabel(t, l.status)} />{l.archived_at && <span className="tag ml-2">{t("leads.archivedTag")}</span>}</span>
                  <span className="text-sm md:col-span-2">
                    {l.assigned_to ? <span className="text-muted">{staffName.get(l.assigned_to) ?? "—"}</span> : <span className="text-warning">{t("leads.unassigned")}</span>}
                    {l.follow_up_on && (
                      <span className={`mt-1 block ${state === "overdue" ? "text-danger" : state === "today" ? "text-warning" : "text-muted"}`}>
                        {t("leads.followUp", { date: l.follow_up_on })}{state === "overdue" && t("leads.overdue")}
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-muted md:col-span-2 md:text-right">
                    {dateTime(l.created_at, lang)}
                    <span className="mt-1 block">{last ? `${activityLabel(t, last.type)}: ${dateTime(last.occurred_at, lang)}` : t("leads.noContact")}</span>
                  </span>
                  <LinkPending />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label={t("leads.pagesAria")} className="mt-6 flex items-center justify-between text-sm">
          {f.page > 1 ? <Link className="btn btn-ghost" href={listHref(f, { page: String(f.page - 1) })}>{t("leads.prev")}</Link> : <span />}
          <span>{t("leads.page", { page: f.page, pages })}</span>
          {f.page < pages ? <Link className="btn btn-ghost" href={listHref(f, { page: String(f.page + 1) })}>{t("leads.next")}</Link> : <span />}
        </nav>
      )}
    </main>
  );
}
