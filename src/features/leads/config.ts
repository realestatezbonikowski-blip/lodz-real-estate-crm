// Which server credential calls public.submit_lead(). Exactly one may be configured:
//   LEAD_INTAKE_DATABASE_URL  Option B (dedicated lead_intake role via the pooler; preferred, unverified)
//   SUPABASE_SECRET_KEY       Option A (secret key; only after an explicit decision in docs/decisions.md)
// Both set, or neither, is not a usable configuration. There is NO automatic fallback from B to A
// (docs/lead-intake-credential.md, section 3).

export type IntakeMode = "option-b" | "option-a" | "none" | "conflict";

export function resolveIntakeMode(env: Record<string, string | undefined>): IntakeMode {
  const b = Boolean(env.LEAD_INTAKE_DATABASE_URL);
  const a = Boolean(env.SUPABASE_SECRET_KEY);
  if (a && b) return "conflict";
  if (b) return "option-b";
  if (a) return "option-a";
  return "none";
}

// The version string stored on every web lead (leads.privacy_notice_version is NOT NULL for web
// leads). It is a PLACEHOLDER: the real notice text and version are a legal decision
// (docs/gdpr-open-questions.md, items 1, 2, 4). The site must not launch with this value.
export const PRIVACY_NOTICE_VERSION = "placeholder-0";
