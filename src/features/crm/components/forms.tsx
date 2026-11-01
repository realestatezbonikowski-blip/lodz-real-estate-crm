"use client";

import { useActionState, useTransition } from "react";
import { Message } from "@/components/Message";
import { addActivity, assignLead, createManualLead, deleteLead, setArchived, setFollowUp, updateContact, updateLeadStatus } from "../actions";
import { ACTIVITY_LABELS, STATUS_LABELS } from "../labels";
import { ACTIVITY_TYPES, LEAD_STATUSES, type ActionResult, type LeadStatus } from "../schema";
import type { ProjectOption, StaffMember } from "../queries";

/** Success/error message announced to screen readers. */
export function Notice({ result }: { result: ActionResult }) {
  if (!result) return null;
  return (
    <Message tone={result.ok ? "success" : "error"}>{result.message}</Message>
  );
}

function Field({ name, label, defaultValue, type = "text", required = true, rows, result, maxLength = 100, autoComplete = "off" }: {
  name: string; label: string; defaultValue?: string; type?: string; required?: boolean; rows?: number;
  result: ActionResult; maxLength?: number; autoComplete?: string;
}) {
  const bad = result && !result.ok && result.fields?.includes(name);
  const shared = { id: name, name, required, maxLength, defaultValue, autoComplete, className: "field", "aria-invalid": bad || undefined };
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm">{label}</label>
      {rows ? <textarea {...shared} rows={rows} /> : <input {...shared} type={type} />}
    </div>
  );
}

export function StatusForm({ leadId, status }: { leadId: string; status: LeadStatus }) {
  const [result, action, pending] = useActionState(updateLeadStatus.bind(null, leadId), null);
  return (
    <form action={action} className="grid gap-3">
      <label htmlFor="status" className="text-sm">Status</label>
      <div className="flex flex-wrap gap-2">
        <select id="status" name="status" defaultValue={status} className="field max-w-xs">
          {LEAD_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <button className="btn btn-primary" disabled={pending}>{pending ? "Zapisywanie…" : "Zapisz status"}</button>
      </div>
      <Notice result={result} />
    </form>
  );
}

export function AssignForm({ leadId, assignedTo, staff }: { leadId: string; assignedTo: string | null; staff: StaffMember[] }) {
  const [result, action, pending] = useActionState(assignLead.bind(null, leadId), null);
  return (
    <form action={action} className="grid gap-3">
      <label htmlFor="assignedTo" className="text-sm">Opiekun</label>
      <div className="flex flex-wrap gap-2">
        <select id="assignedTo" name="assignedTo" defaultValue={assignedTo ?? ""} className="field max-w-xs">
          <option value="">Nieprzypisany</option>
          {staff.filter((s) => s.is_active || s.id === assignedTo).map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
        <button className="btn btn-ghost" disabled={pending}>{pending ? "Zapisywanie…" : "Zapisz opiekuna"}</button>
      </div>
      <Notice result={result} />
    </form>
  );
}

export function FollowUpForm({ leadId, followUpOn, nextAction }: { leadId: string; followUpOn: string | null; nextAction: string | null }) {
  const [result, action, pending] = useActionState(setFollowUp.bind(null, leadId), null);
  return (
    <form action={action} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="followUpOn" className="mb-1 block text-sm">Następny kontakt (data)</label>
          <input id="followUpOn" name="followUpOn" type="date" defaultValue={followUpOn ?? ""} className="field" aria-invalid={result && !result.ok && result.fields?.includes("followUpOn") ? true : undefined} />
        </div>
        <div>
          <label htmlFor="nextAction" className="mb-1 block text-sm">Następny krok</label>
          <input id="nextAction" name="nextAction" maxLength={200} defaultValue={nextAction ?? ""} placeholder="np. oddzwonić po 16:00" className="field" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-ghost" disabled={pending}>{pending ? "Zapisywanie…" : "Zapisz termin"}</button>
        <span className="text-sm text-muted">Puste pola usuwają termin.</span>
      </div>
      <Notice result={result} />
    </form>
  );
}

export function ActivityForm({ leadId }: { leadId: string }) {
  const [result, action, pending] = useActionState(addActivity.bind(null, leadId), null);
  return (
    <form action={action} className="grid gap-3" key={result?.ok ? "sent" : "draft"}>
      <div>
        <label htmlFor="type" className="mb-1 block text-sm">Rodzaj wpisu</label>
        <select id="type" name="type" defaultValue="note" className="field max-w-xs">
          {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{ACTIVITY_LABELS[t]}</option>)}
        </select>
      </div>
      <Field name="body" label="Treść" rows={4} maxLength={5000} result={result} />
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Dodawanie…" : "Dodaj wpis"}</button>
        <Notice result={result} />
      </div>
    </form>
  );
}

export function ContactForm({ leadId, lead }: { leadId: string; lead: { first_name: string; last_name: string; phone: string; email: string } }) {
  const [result, action, pending] = useActionState(updateContact.bind(null, leadId), null);
  return (
    <form action={action} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="firstName" label="Imię" defaultValue={lead.first_name} result={result} autoComplete="off" />
        <Field name="lastName" label="Nazwisko" defaultValue={lead.last_name} result={result} />
      </div>
      <Field name="phone" label="Telefon" type="tel" defaultValue={lead.phone} result={result} maxLength={25} />
      <Field name="email" label="E-mail" type="email" defaultValue={lead.email} result={result} maxLength={254} />
      <p className="text-xs text-muted">Zmiana danych kontaktowych jest zapisywana w dzienniku zdarzeń (tylko nazwy pól, bez wartości).</p>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-ghost" disabled={pending}>{pending ? "Zapisywanie…" : "Zapisz dane"}</button>
        <Notice result={result} />
      </div>
    </form>
  );
}

export function ArchiveButton({ leadId, archived }: { leadId: string; archived: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button className="btn btn-ghost" disabled={pending} onClick={() => start(async () => { await setArchived(leadId, !archived); })}>
      {pending ? "Zapisywanie…" : archived ? "Przywróć z archiwum" : "Archiwizuj"}
    </button>
  );
}

export function DeleteForm({ leadId }: { leadId: string }) {
  const [result, action, pending] = useActionState(deleteLead.bind(null, leadId), null);
  return (
    <form action={action} className="grid gap-3">
      <p className="text-sm text-muted">Usunięcie jest nieodwracalne i obejmuje historię kontaktu tego leada. Zdarzenie zostanie zapisane w dzienniku (bez danych osobowych).</p>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="confirm" className="check" /> Potwierdzam usunięcie tego leada
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-danger" disabled={pending}>{pending ? "Usuwanie…" : "Usuń lead"}</button>
        <Notice result={result} />
      </div>
    </form>
  );
}

export function ManualLeadForm({ projects }: { projects: ProjectOption[] }) {
  const [result, action, pending] = useActionState(createManualLead, null);
  return (
    <form action={action} className="grid max-w-xl gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="firstName" label="Imię" result={result} />
        <Field name="lastName" label="Nazwisko" result={result} />
      </div>
      <Field name="phone" label="Telefon" type="tel" result={result} maxLength={25} autoComplete="off" />
      <Field name="email" label="E-mail" type="email" result={result} maxLength={254} />
      <div>
        <label htmlFor="projectId" className="mb-1 block text-sm">Inwestycja (opcjonalnie)</label>
        <select id="projectId" name="projectId" defaultValue="" className="field">
          <option value="">Ogólne zapytanie</option>
          {projects.filter((p) => p.is_active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <Field name="message" label="Notatka z rozmowy (opcjonalnie)" required={false} rows={4} maxLength={2000} result={result} />
      <p className="text-xs text-muted">Lead zostanie oznaczony jako dodany ręcznie i przypisany do Ciebie jako twórcy. Sposób przekazania informacji o danych osobowych przy zapytaniach telefonicznych jest kwestią do ustalenia z doradcą prawnym.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Zapisywanie…" : "Dodaj lead"}</button>
        <Notice result={result} />
      </div>
    </form>
  );
}
