// The public enquiry pipeline, as a pure function with injected dependencies so every branch can be
// tested without Next.js, the network or a database. The route handler only wires real dependencies.
//
// Order (cheapest and most restrictive first):
//   origin -> rate limit -> body size/JSON -> honeypot -> Zod -> intake configured -> Turnstile -> submit_lead
//
// Responses never echo input values and never reveal whether a lead was a duplicate.
import { failedFields, leadSchema, sanitiseReferrer } from "./schema.ts";
import type { RateLimiter } from "../../lib/security/rate-limit.ts";
import type { TurnstileVerifier } from "../../lib/security/turnstile.ts";

export type SubmitOutcome = "created" | "duplicate" | "rate_limited";

export type SubmitLeadParams = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  projectSlug: string | null;
  message: string | null;
  locale: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  landingPath: string | null;
  referrer: string | null;
  privacyNoticeVersion: string;
};

/** Thrown by a submitter when the database reports invalid_project (SQLSTATE 22023). */
export class InvalidProjectError extends Error {}

export interface LeadSubmitter {
  submit(params: SubmitLeadParams): Promise<SubmitOutcome>;
}

export type Deps = {
  allowedOrigin: string | null;
  privacyNoticeVersion: string;
  submitter: LeadSubmitter | null;
  verifyTurnstile: TurnstileVerifier;
  limiter: RateLimiter;
  maxBodyBytes?: number;
  /** Operational signals only; must never receive personal data. */
  onEvent?: (event: "rate_limited_by_database" | "submit_error" | "intake_unavailable") => void;
};

/** clientKey is undefined when no trusted client address is known: the per-client limit is then skipped, never shared. */
export type HandlerRequest = { origin: string | null; clientKey?: string; bodyText: string };

export type HandlerResponse = {
  status: number;
  body:
    | { status: "ok" }
    | { status: "invalid"; fields: string[] }
    | { status: "invalid_project" }
    | { status: "verification_failed" }
    | { status: "too_many_requests" }
    | { status: "forbidden" }
    | { status: "unavailable" };
  retryAfterSec?: number;
};

const res = (status: number, body: HandlerResponse["body"], retryAfterSec?: number): HandlerResponse => ({
  status,
  body,
  retryAfterSec,
});

export async function handleLeadSubmission(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  if (!deps.allowedOrigin) return res(503, { status: "unavailable" });
  if (req.origin !== deps.allowedOrigin) return res(403, { status: "forbidden" });

  if (req.clientKey) {
    const limit = deps.limiter.check(req.clientKey);
    if (!limit.allowed) return res(429, { status: "too_many_requests" }, limit.retryAfterSec);
  }

  const max = deps.maxBodyBytes ?? 10_000;
  if (new TextEncoder().encode(req.bodyText).length > max) return res(413, { status: "invalid", fields: ["body"] });

  let raw: unknown;
  try {
    raw = JSON.parse(req.bodyText);
  } catch {
    return res(400, { status: "invalid", fields: ["body"] });
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return res(400, { status: "invalid", fields: ["body"] });
  }

  // Honeypot: pretend success, store nothing, spend nothing.
  const trap = (raw as Record<string, unknown>).website;
  if (typeof trap === "string" && trap !== "") return res(200, { status: "ok" });

  const parsed = leadSchema.safeParse(raw);
  if (!parsed.success) return res(422, { status: "invalid", fields: failedFields(parsed.error) });
  const d = parsed.data;

  if (!deps.submitter) {
    deps.onEvent?.("intake_unavailable");
    return res(503, { status: "unavailable" });
  }

  const human = await deps.verifyTurnstile(d.turnstileToken);
  if (human === "error") return res(503, { status: "unavailable" });
  if (human === "failed") return res(400, { status: "verification_failed" });

  try {
    const outcome = await deps.submitter.submit({
      firstName: d.firstName,
      lastName: d.lastName,
      phone: d.phone,
      email: d.email,
      projectSlug: d.projectSlug,
      message: d.message ?? null,
      locale: d.locale,
      utmSource: d.utmSource ?? null,
      utmMedium: d.utmMedium ?? null,
      utmCampaign: d.utmCampaign ?? null,
      landingPath: d.landingPath ?? null,
      referrer: sanitiseReferrer(d.referrer) ?? null,
      privacyNoticeVersion: deps.privacyNoticeVersion,
    });
    if (outcome === "rate_limited") {
      // Not success: the visitor must not believe the enquiry was stored. The owner must be alerted.
      deps.onEvent?.("rate_limited_by_database");
      return res(503, { status: "unavailable" });
    }
    // 'created' and 'duplicate' look identical to the visitor.
    return res(200, { status: "ok" });
  } catch (e) {
    if (e instanceof InvalidProjectError) return res(422, { status: "invalid_project" });
    deps.onEvent?.("submit_error"); // the error object itself is deliberately not passed on or logged
    return res(503, { status: "unavailable" });
  }
}
