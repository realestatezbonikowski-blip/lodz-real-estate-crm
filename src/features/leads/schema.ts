// Server-side validation of a public lead enquiry. These rules mirror the CHECK constraints on
// public.leads (the database is the last line of defence); this layer gives clean error codes.
// Pure module: imported by the route handler and by tests. Relative imports only.
import { z } from "zod";

export const LOCALES = ["pl", "uk", "en"] as const;

// Same character classes as the table constraints.
const ANY_CONTROL = /[\u0000-\u001f\u007f]/;
const BAD_MESSAGE_CONTROL = /[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

const oneLine = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((v) => !ANY_CONTROL.test(v), { message: "control_chars" });

const optionalOneLine = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((v) => !ANY_CONTROL.test(v), { message: "control_chars" })
    .optional()
    .transform((v) => (v ? v : undefined));

export const leadSchema = z.strictObject({
  firstName: oneLine(100),
  lastName: oneLine(100),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9 ()-]{4,24}$/, { message: "phone_format" }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, { message: "email_format" })
    .refine((v) => !ANY_CONTROL.test(v), { message: "control_chars" }),
  message: z
    .string()
    .trim()
    .max(2000)
    .refine((v) => !BAD_MESSAGE_CONTROL.test(v), { message: "control_chars" })
    .optional()
    .transform((v) => (v ? v : undefined)),
  locale: z.enum(LOCALES),
  // null/absent = general enquiry. Whether the project is active and published is decided by the
  // database inside submit_lead.
  projectSlug: z
    .string()
    .max(64)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: "slug_format" })
    .nullish()
    .transform((v) => v ?? null),

  // Attribution. Optional; stored only for web leads (see docs/gdpr-open-questions.md, item 10).
  utmSource: optionalOneLine(200),
  utmMedium: optionalOneLine(200),
  utmCampaign: optionalOneLine(200),
  landingPath: z
    .string()
    .trim()
    .max(300)
    .regex(/^\/[^\u0000-\u001f\u007f]*$/, { message: "path_format" })
    .optional()
    .transform((v) => (v ? v : undefined)),
  referrer: optionalOneLine(500),

  turnstileToken: z.string().min(1).max(2048),
  // Honeypot: real users never fill it. The handler answers "ok" without storing when it is set.
  website: z.string().max(200).optional(),
});

export type LeadInput = z.infer<typeof leadSchema>;

/** Keeps origin + path of a referrer; drops the query string and fragment (they can carry personal data). */
export function sanitiseReferrer(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" && u.protocol !== "http:") return undefined;
    return `${u.origin}${u.pathname}`.slice(0, 500);
  } catch {
    return undefined;
  }
}

/** Field names that failed validation (never the values). */
export function failedFields(error: z.ZodError): string[] {
  return [...new Set(error.issues.map((i) => String(i.path[0] ?? "body")))];
}
