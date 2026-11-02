"use client";

import { useActionState, useTransition } from "react";
import { Message } from "@/components/Message";
import { useT } from "@/features/admin-prefs/provider";
import { addActivity, assignLead, createManualLead, deleteLead, setArchived, setFollowUp, updateContact, updateLeadStatus } from "../actions";
import { activityLabel, statusLabel } from "../labels";
import { ACTIVITY_TYPES, LEAD_STATUSES, type ActionResult, type LeadStatus } from "../schema";
import type { ProjectOption, StaffMember } from "../queries";

/** Success/error message announced to screen readers. The text is translated by the server action. */
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
  // Keyboard hints for phones: the right keyboard, no auto-capitalised e-mail addresses, names capitalised.
  const hints =
    type === "email" ? { inputMode: "email" as const, autoCapitalize: "none", autoCorrect: "off", spellCheck: false } :
    type === "tel" ? { inputMode: "tel" as const } :
    name === "firstName" || name === "lastName" ? { autoCapitalize: "words" } : {};
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm">{label}</label>
      {rows ? <textarea {...shared} rows={rows} /> : <input {...shared} {...hints} type={type} />}
    </div>
  );
}

export function StatusForm({ leadId, status }: { leadId: string; status: LeadStatus }) {
  const { t } = useT();
  const [result, action, pending] = useActionState(updateLeadStatus.bind(null, leadId), null);
  return (
    <form action={action} className="grid gap-3">
      <label htmlFor="status" className="text-sm">{t("form.status")}</label>
      <div className="flex flex-wrap gap-2">
        <select id="status" name="status" defaultValue={status} className="field max-w-xs">
          {LEAD_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(t, s)}</option>)}
        </select>
        <button className="btn btn-primary" disabled={pending}>{pending ? t("common.saving") : t("form.saveStatus")}</button>
      </div>
      <Notice result={result} />
    </form>
  );
}

export function AssignForm({ leadId, assignedTo, staff }: { leadId: string; assignedTo: string | null; staff: StaffMember[] }) {
  const { t } = useT();
  const [result, action, pending] = useActionState(assignLead.bind(null, leadId), null);
  return (
    <form action={action} className="grid gap-3">
      <label htmlFor="assignedTo" className="text-sm">{t("form.assignee")}</label>
      <div className="flex flex-wrap gap-2">
        <select id="assignedTo" name="assignedTo" defaultValue={assignedTo ?? ""} className="field max-w-xs">
          <option value="">{t("form.unassigned")}</option>
          {staff.filter((s) => s.is_active || s.id === assignedTo).map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
        <button className="btn btn-ghost" disabled={pending}>{pending ? t("common.saving") : t("form.saveAssignee")}</button>
      </div>
      <Notice result={result} />
    </form>
  );
}

export function FollowUpForm({ leadId, followUpOn, nextAction }: { leadId: string; followUpOn: string | null; nextAction: string | null }) {
  const { t } = useT();
  const [result, action, pending] = useActionState(setFollowUp.bind(null, leadId), null);
  return (
    <form action={action} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="followUpOn" className="mb-1 block text-sm">{t("form.nextDate")}</label>
          <input id="followUpOn" name="followUpOn" type="date" defaultValue={followUpOn ?? ""} className="field" aria-invalid={result && !result.ok && result.fields?.includes("followUpOn") ? true : undefined} />
        </div>
        <div>
          <label htmlFor="nextAction" className="mb-1 block text-sm">{t("form.nextStep")}</label>
          <input id="nextAction" name="nextAction" maxLength={200} defaultValue={nextAction ?? ""} placeholder={t("form.nextStepPh")} className="field" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-ghost" disabled={pending}>{pending ? t("common.saving") : t("form.saveFollowUp")}</button>
        <span className="text-sm text-muted">{t("form.emptyClears")}</span>
      </div>
      <Notice result={result} />
    </form>
  );
}

export function ActivityForm({ leadId }: { leadId: string }) {
  const { t } = useT();
  const [result, action, pending] = useActionState(addActivity.bind(null, leadId), null);
  return (
    <form action={action} className="grid gap-3" key={result?.ok ? "sent" : "draft"}>
      <div>
        <label htmlFor="type" className="mb-1 block text-sm">{t("form.entryType")}</label>
        <select id="type" name="type" defaultValue="note" className="field max-w-xs">
          {ACTIVITY_TYPES.map((a) => <option key={a} value={a}>{activityLabel(t, a)}</option>)}
        </select>
      </div>
      <Field name="body" label={t("form.body")} rows={4} maxLength={5000} result={result} />
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? t("common.adding") : t("form.addEntry")}</button>
        <Notice result={result} />
      </div>
    </form>
  );
}

export function ContactForm({ leadId, lead }: { leadId: string; lead: { first_name: string; last_name: string; phone: string; email: string } }) {
  const { t } = useT();
  const [result, action, pending] = useActionState(updateContact.bind(null, leadId), null);
  return (
    <form action={action} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="firstName" label={t("form.firstName")} defaultValue={lead.first_name} result={result} autoComplete="off" />
        <Field name="lastName" label={t("form.lastName")} defaultValue={lead.last_name} result={result} />
      </div>
      <Field name="phone" label={t("form.phone")} type="tel" defaultValue={lead.phone} result={result} maxLength={25} />
      <Field name="email" label={t("form.email")} type="email" defaultValue={lead.email} result={result} maxLength={254} />
      <p className="text-xs text-muted">{t("form.contactAudit")}</p>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-ghost" disabled={pending}>{pending ? t("common.saving") : t("form.saveContact")}</button>
        <Notice result={result} />
      </div>
    </form>
  );
}

export function ArchiveButton({ leadId, archived }: { leadId: string; archived: boolean }) {
  const { t } = useT();
  const [pending, start] = useTransition();
  return (
    <button className="btn btn-ghost" disabled={pending} onClick={() => start(async () => { await setArchived(leadId, !archived); })}>
      {pending ? t("common.saving") : archived ? t("form.restore") : t("form.archive")}
    </button>
  );
}

export function DeleteForm({ leadId }: { leadId: string }) {
  const { t } = useT();
  const [result, action, pending] = useActionState(deleteLead.bind(null, leadId), null);
  return (
    <form action={action} className="grid gap-3">
      <p className="text-sm text-muted">{t("form.deleteWarning")}</p>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="confirm" className="check" /> {t("form.deleteConfirm")}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-danger" disabled={pending}>{pending ? t("common.deleting") : t("form.deleteBtn")}</button>
        <Notice result={result} />
      </div>
    </form>
  );
}

export function ManualLeadForm({ projects }: { projects: ProjectOption[] }) {
  const { t } = useT();
  const [result, action, pending] = useActionState(createManualLead, null);
  return (
    <form action={action} className="grid max-w-xl gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="firstName" label={t("form.firstName")} result={result} />
        <Field name="lastName" label={t("form.lastName")} result={result} />
      </div>
      <Field name="phone" label={t("form.phone")} type="tel" result={result} maxLength={25} autoComplete="off" />
      <Field name="email" label={t("form.email")} type="email" result={result} maxLength={254} />
      <div>
        <label htmlFor="projectId" className="mb-1 block text-sm">{t("form.project")}</label>
        <select id="projectId" name="projectId" defaultValue="" className="field">
          <option value="">{t("leads.general")}</option>
          {projects.filter((p) => p.is_active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <Field name="message" label={t("form.note")} required={false} rows={4} maxLength={2000} result={result} />
      <p className="text-xs text-muted">{t("form.manualInfo")}</p>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? t("common.saving") : t("form.addLead")}</button>
        <Notice result={result} />
      </div>
    </form>
  );
}
