import Link from "next/link";
import { Message } from "@/components/Message";
import { ACTIVITY_LABELS, dateTime, LOCALE_LABELS, SOURCE_LABELS, STATUS_LABELS } from "../labels";
import type { Activity, LeadDetail, StaffMember } from "../queries";
import { followUpState, todayWarsaw } from "../schema";
import { ActivityForm, ArchiveButton, AssignForm, ContactForm, DeleteForm, FollowUpForm, StatusForm } from "./forms";
import { StatusBadge } from "./StatusBadge";

type Props = {
  lead: LeadDetail;
  activities: Activity[] | null; // null = could not be loaded
  staff: StaffMember[];
  isOwner: boolean;
  notice?: string;
};

export function LeadDetailView({ lead, activities, staff, isOwner, notice }: Props) {
  const staffName = new Map(staff.map((s) => [s.id, s.full_name]));
  const web = lead.source === "web_form";
  const attribution = [
    ["Kampania", lead.utm_campaign], ["Źródło ruchu", lead.utm_source], ["Medium", lead.utm_medium],
    ["Strona wejścia", lead.landing_path], ["Odsyłacz", lead.referrer],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <main id="content" className="wrap py-8 lg:py-12">
      <p className="text-sm"><Link href="/admin/leads" className="link">← Wszystkie leady</Link></p>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="display text-4xl sm:text-5xl">{lead.first_name} {lead.last_name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            <StatusBadge status={lead.status} />
            {lead.archived_at && <span className="tag">Archiwum</span>}
            <span>{lead.projects?.name ?? "Ogólne zapytanie"}</span>
            <span aria-hidden="true">·</span>
            <span>{SOURCE_LABELS[lead.source]}</span>
            <span aria-hidden="true">·</span>
            <span>{dateTime(lead.created_at)}</span>
          </p>
        </div>
        <ArchiveButton leadId={lead.id} archived={Boolean(lead.archived_at)} />
      </div>

      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div><dt className="text-muted">Opiekun</dt><dd className="font-medium">{lead.assigned_to ? (staffName.get(lead.assigned_to) ?? "—") : <span className="text-warning">Nieprzypisany</span>}</dd></div>
        {lead.follow_up_on && (
          <div>
            <dt className="text-muted">Następny kontakt</dt>
            <dd className={`font-medium ${followUpState(lead.follow_up_on, todayWarsaw()) === "overdue" ? "text-danger" : ""}`}>
              {lead.follow_up_on}{followUpState(lead.follow_up_on, todayWarsaw()) === "overdue" && " (zaległy)"}{lead.next_action ? ` · ${lead.next_action}` : ""}
            </dd>
          </div>
        )}
      </dl>

      {notice && <p role="status" className="mt-4 border border-border bg-paper-deep p-3 text-sm">{notice}</p>}

      <div className="mt-8 grid gap-10 lg:grid-cols-12">
        <div className="grid content-start gap-8 lg:col-span-5">
          <section aria-labelledby="contact" className="card p-5">
            <h2 id="contact" className="eyebrow">Kontakt</h2>
            <dl className="mt-3 grid gap-3">
              <div><dt className="text-sm text-muted">Telefon</dt><dd><a className="link text-lg" href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}>{lead.phone}</a></dd></div>
              <div><dt className="text-sm text-muted">E-mail</dt><dd><a className="link break-all" href={`mailto:${lead.email}`}>{lead.email}</a></dd></div>
              <div><dt className="text-sm text-muted">Język zapytania</dt><dd>{LOCALE_LABELS[lead.locale] ?? lead.locale}</dd></div>
            </dl>
            {lead.message && (
              <div className="mt-4 border-t border-border pt-4">
                <h3 className="text-sm text-muted">Wiadomość od klienta</h3>
                <p className="mt-1 whitespace-pre-wrap break-words">{lead.message}</p>
              </div>
            )}
            <details className="mt-4 border-t border-border pt-4">
              <summary className="cursor-pointer text-sm">Edytuj dane kontaktowe</summary>
              <div className="mt-4"><ContactForm leadId={lead.id} lead={lead} /></div>
            </details>
          </section>

          <section aria-labelledby="manage" className="card grid gap-6 p-5">
            <h2 id="manage" className="eyebrow">Obsługa</h2>
            <StatusForm leadId={lead.id} status={lead.status} />
            <AssignForm leadId={lead.id} assignedTo={lead.assigned_to} staff={staff} />
            <FollowUpForm leadId={lead.id} followUpOn={lead.follow_up_on ?? null} nextAction={lead.next_action ?? null} />
          </section>

          <section aria-labelledby="origin" className="card p-5">
            <h2 id="origin" className="eyebrow">Pochodzenie</h2>
            <dl className="mt-3 grid gap-3 text-sm">
              <div><dt className="text-muted">Źródło</dt><dd>{SOURCE_LABELS[lead.source]}</dd></div>
              {!web && <div><dt className="text-muted">Dodał(a)</dt><dd>{lead.created_by ? (staffName.get(lead.created_by) ?? "—") : "—"}</dd></div>}
              {web && <div><dt className="text-muted">Wersja informacji o danych osobowych</dt><dd>{lead.privacy_notice_version ?? "—"}</dd></div>}
              {attribution.map(([k, v]) => <div key={k}><dt className="text-muted">{k}</dt><dd className="break-all">{v}</dd></div>)}
              <div><dt className="text-muted">Ostatnia zmiana</dt><dd>{dateTime(lead.updated_at)}</dd></div>
            </dl>
          </section>

          {isOwner && (
            <details className="card p-5">
              <summary className="cursor-pointer text-sm text-danger">Usuń lead (tylko właściciel)</summary>
              <div className="mt-4"><DeleteForm leadId={lead.id} /></div>
            </details>
          )}
        </div>

        <section aria-labelledby="history" className="lg:col-span-7">
          <h2 id="history" className="eyebrow">Historia kontaktu</h2>
          <div className="mt-4 card p-5">
            <ActivityForm leadId={lead.id} />
          </div>

          {activities === null ? (
            <Message tone="error" className="mt-6">Nie udało się wczytać historii. Odśwież stronę.</Message>
          ) : activities.length === 0 ? (
            <p className="mt-6 text-muted">Brak wpisów. Dodaj pierwszą notatkę po rozmowie z klientem.</p>
          ) : (
            <ol className="mt-6 grid gap-0 border-l border-border">
              {activities.map((a) => (
                <li key={a.id} className="relative pb-6 pl-6">
                  <span aria-hidden="true" className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 ${a.type === "status_change" ? "bg-info" : "bg-ink"}`} />
                  <p className="text-sm text-muted">
                    <span className="font-medium text-ink">{ACTIVITY_LABELS[a.type]}</span>
                    {" · "}{a.actor_id ? (staffName.get(a.actor_id) ?? "Użytkownik usunięty") : "System"}
                    {" · "}{dateTime(a.occurred_at)}
                  </p>
                  {a.type === "status_change" && a.from_status && a.to_status ? (
                    <p className="mt-1">{STATUS_LABELS[a.from_status]} → <strong>{STATUS_LABELS[a.to_status]}</strong></p>
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap break-words">{a.body}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}
