import Link from "next/link";
import { dateTime, SOURCE_LABELS, STATUS_LABELS } from "../labels";
import type { LeadListItem, ProjectOption, StaffMember } from "../queries";
import { LEAD_STATUSES, listHref, PAGE_SIZE, type LeadFilters, type LeadStatus } from "../schema";
import { StatusBadge } from "./StatusBadge";

type Props = {
  filters: LeadFilters;
  rows: LeadListItem[];
  total: number;
  counts: Record<LeadStatus, number> | null;
  staff: StaffMember[];
  projects: ProjectOption[];
  notice?: string;
};

export function LeadsView({ filters: f, rows, total, counts, staff, projects, notice }: Props) {
  const staffName = new Map(staff.map((s) => [s.id, s.full_name]));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(f.q || f.status || f.project || f.source || f.assigned || f.includeArchived);

  return (
    <main id="content" className="wrap py-8 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl sm:text-5xl">Leady</h1>
          <p className="mt-1 text-sm text-muted" aria-live="polite">
            {total === 0 ? "Brak wyników" : `${total} ${total === 1 ? "lead" : "leadów"}`}
            {filtered && " (filtry aktywne)"}
          </p>
        </div>
        <Link href="/admin/leads/new" className="btn btn-primary">Nowy lead</Link>
      </div>

      {notice && <p role="status" className="mt-4 border border-border bg-paper-deep p-3 text-sm">{notice}</p>}

      {counts && (
        <nav aria-label="Status" className="mt-6 flex flex-wrap gap-2">
          <Link href={listHref(f, { status: undefined })} aria-current={!f.status ? "true" : undefined}
            className="btn btn-ghost min-h-10 px-3 py-1 text-sm aria-[current=true]:bg-ink aria-[current=true]:text-paper">
            Wszystkie <span className="ml-1 text-xs opacity-80">{LEAD_STATUSES.reduce((n, s) => n + counts[s], 0)}</span>
          </Link>
          {LEAD_STATUSES.map((s) => (
            <Link key={s} href={listHref(f, { status: s })} aria-current={f.status === s ? "true" : undefined}
              className="btn btn-ghost min-h-10 px-3 py-1 text-sm aria-[current=true]:bg-ink aria-[current=true]:text-paper">
              {STATUS_LABELS[s]} <span className="ml-1 text-xs opacity-80">{counts[s]}</span>
            </Link>
          ))}
        </nav>
      )}

      <form method="get" action="/admin/leads" className="mt-6 grid gap-3 border border-border p-4 md:grid-cols-6" role="search" aria-label="Szukaj i filtruj leady">
        {f.status && <input type="hidden" name="status" value={f.status} />}
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
            <input type="checkbox" name="archived" value="1" defaultChecked={f.includeArchived} className="h-5 w-5" /> Pokaż archiwum
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
        <ul className="mt-8 divide-y divide-border border-y border-border">
          {rows.map((l) => (
            <li key={l.id}>
              <Link href={`/admin/leads/${l.id}`} className="grid gap-x-6 gap-y-1 px-1 py-4 hover:bg-paper-deep md:grid-cols-12 md:items-center">
                <span className="md:col-span-3">
                  <span className="block font-medium">{l.first_name} {l.last_name}</span>
                  <span className="block text-sm text-muted">{l.projects?.name ?? "Ogólne zapytanie"}</span>
                </span>
                <span className="text-sm md:col-span-3">
                  <span className="block">{l.phone}</span>
                  <span className="block break-all text-muted">{l.email}</span>
                </span>
                <span className="md:col-span-2"><StatusBadge status={l.status} />{l.archived_at && <span className="tag ml-2">Archiwum</span>}</span>
                <span className="text-sm text-muted md:col-span-2">{l.assigned_to ? (staffName.get(l.assigned_to) ?? "—") : "Nieprzypisany"}</span>
                <span className="text-sm text-muted md:col-span-2 md:text-right">{dateTime(l.created_at)}</span>
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
