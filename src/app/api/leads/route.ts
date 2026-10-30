// POST /api/leads: the only public write path. All privileged work happens here, on the server.
//
// Intake credential: only Option B (LEAD_INTAKE_DATABASE_URL, the least-privilege `lead_intake`
// role) is implemented, and that variable must be set only after the live verification in
// docs/lead-intake-credential.md has passed. With nothing configured, with both credentials set,
// or with only the Option A secret key, the submitter is null: after validation the endpoint
// answers 503 "unavailable" and stores nothing. It never falls back to another credential.
import { NextResponse } from "next/server";
import { PRIVACY_NOTICE_VERSION, resolveIntakeMode } from "@/features/leads/config";
import { handleLeadSubmission, type LeadSubmitter } from "@/features/leads/handler";
import { createLeadSubmitter, createPostgresRunner } from "@/features/leads/server/postgres-submitter";
import { createRateLimiter } from "@/lib/security/rate-limit";
import { createTurnstileVerifier } from "@/lib/security/turnstile";

export const runtime = "nodejs";

// Per instance, best effort (see rate-limit.ts). 5 attempts per client per 10 minutes.
const limiter = createRateLimiter({ windowMs: 10 * 60_000, max: 5, maxKeys: 5000 });
const verifyTurnstile = createTurnstileVerifier(process.env.TURNSTILE_SECRET_KEY);

const submitter: LeadSubmitter | null =
  resolveIntakeMode(process.env) === "option-b" && process.env.LEAD_INTAKE_DATABASE_URL
    ? createLeadSubmitter(createPostgresRunner(process.env.LEAD_INTAKE_DATABASE_URL))
    : null;

function allowedOrigin(): string | null {
  try {
    return process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  // Hosting-dependent: only trust x-forwarded-for if the host's proxy sets it. Used in memory only.
  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  const result = await handleLeadSubmission(
    {
      allowedOrigin: allowedOrigin(),
      privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
      submitter,
      verifyTurnstile,
      limiter,
      // TODO(Phase 3): alert the owner on "rate_limited_by_database" (docs/gdpr-open-questions.md, item 18).
      onEvent: (event) => console.warn(`[leads] ${event}`),
    },
    { origin: request.headers.get("origin"), clientKey, bodyText: await request.text() },
  );

  return NextResponse.json(result.body, {
    status: result.status,
    headers: {
      "Cache-Control": "no-store",
      ...(result.retryAfterSec ? { "Retry-After": String(result.retryAfterSec) } : {}),
    },
  });
}
