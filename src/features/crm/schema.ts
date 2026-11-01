// Pure CRM helpers: filter parsing, search sanitising and action input validation. Relative imports
// only (tested with node --test). The CRM is Polish only (docs/decisions.md, row 4).
import { z } from "zod";
import { leadSchema } from "../leads/schema.ts";

export const LEAD_STATUSES = ["new", "contacted", "interested", "meeting", "converted", "not_interested", "unreachable"] as const;
export const ACTIVITY_TYPES = ["note", "call", "email", "meeting"] as const; // status_change is written by a database trigger only
export const SOURCES = ["web_form", "manual"] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const PAGE_SIZE = 25;

const uuid = z.string().uuid();

export type LeadFilters = {
  q?: string;
  status?: LeadStatus;
  project?: string;
  source?: (typeof SOURCES)[number];
  /** A staff id, or "none" for unassigned. */
  assigned?: string;
  /** "due" = follow-up date is today or earlier. */
  followUp?: "due";
  includeArchived: boolean;
  page: number;
};

/**
 * Free-text search is used inside a PostgREST `or=(...)` filter, where `,` `(` `)` `*` `%` and `\`
 * have meaning. Only letters, digits, space and `@ . + - _` are kept, so user input can never add
 * a filter clause. Length is capped.
 */
export function sanitizeSearch(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s@.+_-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function searchWords(raw: string): string[] {
  const s = sanitizeSearch(raw);
  return s ? s.split(" ").slice(0, 4) : [];
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Tolerant: an invalid value is ignored (treated as "no filter"), never an error. */
export function parseFilters(sp: Record<string, string | string[] | undefined>): LeadFilters {
  const status = z.enum(LEAD_STATUSES).safeParse(one(sp.status));
  const project = uuid.safeParse(one(sp.project));
  const source = z.enum(SOURCES).safeParse(one(sp.source));
  const assigned = z.union([uuid, z.literal("none")]).safeParse(one(sp.assigned));
  const page = z.coerce.number().int().min(1).max(10_000).safeParse(one(sp.page));
  const q = sanitizeSearch(one(sp.q) ?? "");
  return {
    q: q || undefined,
    status: status.success ? status.data : undefined,
    project: project.success ? project.data : undefined,
    source: source.success ? source.data : undefined,
    assigned: assigned.success ? assigned.data : undefined,
    followUp: one(sp.followup) === "due" ? "due" : undefined,
    includeArchived: one(sp.archived) === "1",
    page: page.success ? page.data : 1,
  };
}

/** Builds a list URL that keeps the active filters and overrides the given keys. */
export function listHref(f: LeadFilters, over: Partial<Record<"q" | "status" | "project" | "source" | "assigned" | "followup" | "archived" | "page", string | undefined>> = {}): string {
  const base: Record<string, string | undefined> = {
    q: f.q, status: f.status, project: f.project, source: f.source, assigned: f.assigned, followup: f.followUp,
    archived: f.includeArchived ? "1" : undefined,
    page: f.page > 1 ? String(f.page) : undefined,
  };
  const merged = { ...base, ...over };
  if ("page" in over === false && Object.keys(over).length > 0) merged.page = undefined; // changing a filter resets paging
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `/admin/leads?${s}` : "/admin/leads";
}

// ---- Action input validation -------------------------------------------------------------------

const bodyText = z
  .string()
  .trim()
  .min(1, "Treść nie może być pusta.")
  .max(5000, "Treść jest za długa (maksymalnie 5000 znaków).")
  .refine((v) => !/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v), "Treść zawiera niedozwolone znaki.");

export const activitySchema = z.strictObject({ type: z.enum(ACTIVITY_TYPES), body: bodyText });
export const statusSchema = z.strictObject({ status: z.enum(LEAD_STATUSES) });
export const assignSchema = z.strictObject({
  assignedTo: z.union([uuid, z.literal("")]).transform((v) => (v === "" ? null : v)),
});

/** Contact fields reuse the exact rules of the public form (which mirror the table constraints). */
export const contactSchema = leadSchema.pick({ firstName: true, lastName: true, phone: true, email: true });

export const manualLeadSchema = leadSchema
  .pick({ firstName: true, lastName: true, phone: true, email: true, message: true })
  .extend({ projectId: z.union([uuid, z.literal("")]).transform((v) => (v === "" ? null : v)) });

export type ActionResult = { ok: true; message: string } | { ok: false; message: string; fields?: string[] } | null;

export function fieldErrors(error: z.ZodError): string[] {
  return [...new Set(error.issues.map((i) => String(i.path[0] ?? "")))].filter(Boolean);
}

// ---- Follow-up and team (opiekunowie) ----------------------------------------------------------

/** Today's date (YYYY-MM-DD) in the CRM's time zone. */
export function todayWarsaw(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

const isRealDate = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/** Empty = clear the follow-up. A date must be a real calendar day. */
export const followUpSchema = z.strictObject({
  followUpOn: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && isRealDate(v)), "Podaj poprawną datę.")
    .transform((v) => (v === "" ? null : v)),
  nextAction: z
    .string()
    .trim()
    .max(200, "Następny krok może mieć najwyżej 200 znaków.")
    .refine((v) => !/[\u0000-\u001f\u007f]/.test(v), "Tekst zawiera niedozwolone znaki.")
    .transform((v) => (v === "" ? null : v)),
});

export type FollowUpState = "overdue" | "today" | "upcoming" | null;
export function followUpState(date: string | null | undefined, today: string): FollowUpState {
  if (!date) return null;
  return date < today ? "overdue" : date === today ? "today" : "upcoming";
}

/** New team member: a real e-mail and a display name. Role is NOT an input (always the least-privileged "assistant"). */
export const inviteSchema = z.strictObject({
  email: z.string().trim().toLowerCase().max(254).email("Podaj poprawny adres e-mail."),
  fullName: z
    .string()
    .trim()
    .min(1, "Podaj imię i nazwisko.")
    .max(120, "Imię i nazwisko jest za długie.")
    .refine((v) => !/[\u0000-\u001f\u007f]/.test(v), "Tekst zawiera niedozwolone znaki."),
});
export const activeSchema = z.strictObject({ userId: z.string().uuid(), active: z.enum(["true", "false"]).transform((v) => v === "true") });
export const passwordSchema = z.strictObject({
  password: z.string().min(12, "Hasło musi mieć co najmniej 12 znaków.").max(72, "Hasło może mieć najwyżej 72 znaki."),
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { message: "Hasła nie są takie same.", path: ["confirm"] });
