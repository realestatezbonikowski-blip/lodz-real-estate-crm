import { CalendarCheck, CircleCheck, CircleDot, Users } from "lucide-react";
import Link from "next/link";
import { ACTIVITY_LABELS, dateTime, leadCount, SOURCE_LABELS, STATUS_LABELS } from "../labels";
import type { LatestContact, LeadListItem, ProjectOption, StaffMember } from "../queries";
import { followUpState, LEAD_STATUSES, listHref, PAGE_SIZE, todayWarsaw, type LeadFilters, type LeadStatus } from "../schema";
import { ActiveTabScroll } from "./ActiveTabScroll";
import { StatusBadge } from "./StatusBadge";

type Props = {
  filters: LeadFilters;
  rows: LeadListItem[];
  total: number;
  counts: Record<LeadStatus, number> | null;
  staff: StaffMember[];
  projects: ProjectOption[];
  notice?: string;
  me: string;
  isOwner: boolean;
  contacts: Record<string, LatestContact>;
  /** Unassigned, non-archived leads in the whole database (owner only; null for an opiekun). */
  unassignedTotal: number | null;
};

export function LeadsView({ filters: f, rows, total, counts, staff, projects, notice, me, isOwner, contacts, unassignedTotal }: Props) {
  const today = todayWarsaw();
  const hasOpiekun = staff.some((s) => s.role === "assistant" && s.is_active);
  const showStart = isOwner && (!hasOpiekun || (unassignedTotal ?? 0) > 0);
  const staffName = new Map(staff.map((s) => [s.id, s.full_name]));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(f.q || f.status || f.project || f.source || f.assigned || f.followUp || f.includeArchived);

  return (
    <main id="content" className="wrap py-8 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl sm:text-5xl">Leady</h1>
          <p className="mt-1 text-sm text-muted" aria-live="polite">
            {total === 0 ? "Brak wyników" : leadCount(total)}
            {filtered && " (filtry aktywne)"}
          </p>
        </div>
        <Link href="/admin/leads/new" className="btn btn-primary">Nowy lead</Link>
      </div>

      {notice && <p role="status" className="mt-4 border border-border bg-paper-deep p-3 text-sm">{notice}</p>}

      {showStart && (
        <section aria-labelledby="start" className="crm-panel mt-6 p-5">
          <h2 id="start" className="eyebrow">Pierwsze kroki</h2>
          <ol className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <li className="flex items-start gap-3">
              <span className={`tag ${hasOpiekun ? "tone-success" : "tone-warning"}`}>{hasOpiekun ? "Gotowe" : "Do zrobienia"}</span>
              <span>{hasOpiekun ? "Masz w zespole co najmniej jednego opiekuna." : <>Dodaj opiekuna w zakładce <Link className="link" href="/admin/team">Zespół</Link>.</>}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className={`tag ${(unassignedTotal ?? 0) === 0 ? "tone-success" : "tone-warning"}`}>{(unassignedTotal ?? 0) === 0 ? "Gotowe" : `${unassignedTotal} do przypisania`}</span>
              <span>{(unassignedTotal ?? 0) === 0 ? "Wszystkie aktywne leady mają opiekuna." : <>Otwórz lead i wybierz opiekuna, albo zacznij od <Link className="link" href="/admin/leads?assigned=none">listy nieprzypisanych</Link>.</>}</span>
            </li>
          </ol>
          <p className="mt-3 text-sm text-muted">Cały przebieg pracy opisuje <Link className="link" href="/admin/help">Pomoc</Link>.</p>
        </section>
      )}

      <nav aria-label="Widoki" className="mt-6 flex flex-wrap gap-2">
        <Link href={listHref(f, { assigned: me, followup: undefined })} aria-current={f.assigned === me ? "true" : undefined} className="crm-tab text-sm">Moje leady</Link>
        <Link href={listHref(f, { assigned: "none", followup: undefined })} aria-current={f.assigned === "none" ? "true" : undefined} className="crm-tab text-sm">Nieprzypisane</Link>
        <Link href={listHref(f, { followup: f.followUp ? undefined : "due" })} aria-current={f.followUp ? "true" : undefined} className="crm-tab text-sm">Do kontaktu dziś i zaległe</Link>
      </nav>

      {counts && (
        <section aria-label="Podsumowanie" className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {([
            { label: "Wszystkie", value: LEAD_STATUSES.reduce((n, s) => n + counts[s], 0), status: undefined, Icon: Users },
            { label: "Nowe", value: counts.new, status: "new", Icon: CircleDot },
            { label: "Spotkania", value: counts.meeting, status: "meeting", Icon: CalendarCheck },
            { label: "Zrealizowane", value: counts.converted, status: "converted", Icon: CircleCheck },
          ] as const).map((k) => (
            <Link key={k.label} href={listHref(f, { status: k.status })} className="kpi">
              <k.Icon size={18} strokeWidth={1.75} aria-hidden="true" className="kpi-icon" />
              <span className="kpi-value">{k.value}</span>
              <span className="kpi-label">{k.label}</span>
            </Link>
          ))}
        </section>
      )}

      {counts && (
        <nav aria-label="Status" className="mt-4 flex gap-2 overflow-x-auto pb-1 md:flex-wrap">
          <ActiveTabScroll />
          <Link href={listHref(f, { status: undefined })} aria-current={!f.status ? "true" : undefined}
            className="crm-tab shrink-0 text-sm">
            Wszystkie <span className="ml-1 text-xs opacity-80">{LEAD_STATUSES.reduce((n, s) => n + counts[s], 0)}</span>
          </Link>
          {LEAD_STATUSES.map((s) => (
            <Link key={s} href={listHref(f, { status: s })} aria-current={f.status === s ? "true" : undefined}
              className="crm-tab shrink-0 text-sm">
              {STATUS_LABELS[s]} <span className="ml-1 text-xs opacity-80">{counts[s]}</span>
            </Link>
          ))}
        </nav>
      )}

      <form method="get" action="/admin/leads" className="crm-panel mt-6 grid gap-3 p-4 md:grid-cols-6" role="search" aria-label="Szukaj i filtruj leady">
        {f.status && <input type="hidden" name="status" value={f.status} />}
        {f.followUp && <input type="hidden" name="followup" value="due" />}
        <div className="md:col-span-2">
          <label htmlFor="q" className="mb-1 block text-sm">Szukaj</label>
          <input id="q" name="q" defaultValue={f.q} placeholder="Imię, nazwisko, e-mail, telefon" maxLength={80} className="field" />
        </div>
        <div>
          <label htmlFor="project" className="mb-1 block text-sm">Inwestycja</label>
          <select id="project" name="project" defaultValue={f.project ?? ""} className="field">
            <option value="">Wszystkie</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="source" className="mb-1 block text-sm">Źródło</label>
          <select id="source" name="source" defaultValue={f.source ?? ""} className="field">
            <option value="">Wszystkie</option>
            <option value="web_form">{SOURCE_LABELS.web_form}</option>
            <option value="manual">{SOURCE_LABELS.manual}</option>
          </select>
        </div>
        <div>
          <label htmlFor="assigned" className="mb-1 block text-sm">Opiekun</label>
          <select id="assigned" name="assigned" defaultValue={f.assigned ?? ""} className="field">
            <option value="">Wszyscy</option>
            <option value="none">Nieprzypisane</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="archived" value="1" defaultChecked={f.includeArchived} className="check" /> Pokaż archiwum
          </label>
        </div>
        <div className="flex gap-2 md:col-span-6">
          <button className="btn btn-primary">Filtruj</button>
          {filtered && <Link href="/admin/leads" className="btn btn-ghost">Wyczyść</Link>}
        </div>
      </form>

      {rows.length === 0 ? (
        <div className="mt-8 border border-dashed border-border p-10 text-center">
          <p className="display text-3xl">{filtered ? "Brak leadów dla tych filtrów" : "Brak leadów"}</p>
          <p className="mt-2 text-muted">
            {filtered ? "Zmień kryteria wyszukiwania albo wyczyść filtry." : "Zapytania z formularza na stronie oraz leady dodane ręcznie pojawią się tutaj."}
          </p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-2">
          {rows.map((l) => (
            <li key={l.id}>
              <Link href={`/admin/leads/${l.id}`} className="lead-row grid gap-x-6 gap-y-1 md:grid-cols-12 md:items-center">
                <span className="md:col-span-3">
                  <span className="block font-medium">{l.first_name} {l.last_name}</span>
                  <span className="block text-sm text-muted">{l.projects?.name ?? "Ogólne zapytanie"}</span>
                </span>
                <span className="text-sm md:col-span-3">
                  <span className="block">{l.phone}</span>
                  <span className="block break-all text-muted">{l.email}</span>
                </span>
                <span className="mt-1 md:col-span-2 md:mt-0"><StatusBadge status={l.status} />{l.archived_at && <span className="tag ml-2">Archiwum</span>}</span>
                <span className="text-sm md:col-span-2">
                  {l.assigned_to ? <span className="text-muted">{staffName.get(l.assigned_to) ?? "—"}</span> : <span className="text-warning">Nieprzypisany</span>}
                  {l.follow_up_on && (
                    <span className={`mt-1 block ${followUpState(l.follow_up_on, today) === "overdue" ? "text-danger" : followUpState(l.follow_up_on, today) === "today" ? "text-warning" : "text-muted"}`}>
                      Kontakt: {l.follow_up_on}{followUpState(l.follow_up_on, today) === "overdue" && " (zaległy)"}
                    </span>
                  )}
                </span>
                <span className="text-sm text-muted md:col-span-2 md:text-right">
                  {dateTime(l.created_at)}
                  <span className="mt-1 block">{contacts[l.id] ? `${ACTIVITY_LABELS[contacts[l.id]!.type]}: ${dateTime(contacts[l.id]!.occurred_at)}` : "Brak kontaktu"}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Strony" className="mt-6 flex items-center justify-between text-sm">
          {f.page > 1 ? <Link className="btn btn-ghost" href={listHref(f, { page: String(f.page - 1) })}>← Poprzednia</Link> : <span />}
          <span>Strona {f.page} z {pages}</span>
          {f.page < pages ? <Link className="btn btn-ghost" href={listHref(f, { page: String(f.page + 1) })}>Następna →</Link> : <span />}
        </nav>
      )}
    </main>
  );
}
