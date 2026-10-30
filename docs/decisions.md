# Decisions log

| # | Decision | Reason |
|---|---|---|
| 1 | Next.js App Router + Supabase, single app | Simple, maintainable for a small business |
| 2 | Free dev environment; hosting not yet chosen | Vercel Hobby is non-commercial; evaluate before launch |
| 3 | Roles: `owner` (full), `assistant` (view/update leads, statuses, notes, contact history) | Owner alone: staff accounts, delete leads, export all data, manage projects |
| 4 | CRM in Polish only; public site PL (default) / UK / EN, locale prefix always | Business requirement |
| 5 | Lead form: first name, surname, phone, email, project, optional message | Data minimisation |
| 6 | Project content lives in code + `messages/*.json`; no CMS | Avoid unconfirmed scope |
| 7 | No Docker; develop against a free hosted Supabase dev project | Simplest on Windows; migrations in git keep it reproducible |
| 8 | Spam protection: Turnstile + honeypot + duplicate throttle; no IP limiter initially | A hashed IP is still personal data |
| 9 | Notifications deferred; if used, send no personal data in the message | Provider and cost to be evaluated |
| 10 | Supabase dev project region: West EU (Ireland), `eu-west-1` (as created by the owner; do not change) | Still within the EU. Supersedes the earlier Frankfurt recommendation |
| 11 | Leads are created only by `public.submit_lead()`, executable by the server-only secret key; no anon/authenticated insert path | Prevents bypassing Turnstile and validation. Replaces the earlier idea of an anon-callable function |
| 12 | Staff accounts created via dashboard + SQL bootstrap until a staff UI exists; no signup trigger | A profile-creating trigger is a privilege-escalation risk |
| 13 | Public key variable is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (renamed from `..._ANON_KEY`) | Supabase publishable keys; legacy anon key still works |
| 14 | RLS tests run locally on PGlite via `npm run test:db` (dev dependency) | No Docker needed; real Postgres engine. Must be re-checked once on the real dev project |

| 15 | Audit actor is not a foreign key; activity authors cannot be deleted (deactivate instead) | Deleting staff must never rewrite history |
| 16 | Global hourly cap (100) on web leads inside `submit_lead` | Bounds floods that Turnstile and the per-email throttle do not |
| 17 | Staff may add manual (phone) leads, attributed to themselves | Business requirement from the owner |
| 18 | Project `slug` is immutable via the API | Public content and links are keyed by it |
| 19 | No global default-privilege change for functions; each new function in `public` must revoke `PUBLIC` explicitly (tested) | A global change would affect every schema |
| 20 | MFA in RLS prepared as a planned, untested-live file; applied only after the MFA screens exist | Avoids locking staff out |
| 21 | Intake credential: Option A (secret key) vs B (`lead_intake` role) decided in Phase 3 | See `docs/security-review-phase-1b.md` |
| 22 | Activity history stays append-only (owner decision) | Reliable record; corrections are new notes |
| 23 | Audit contact-detail and assignment changes (field names / staff ids only, never values) | Owner decision; rectification trail without copying personal data |
| 24 | Initial limits: 100 web leads/hour, 10-minute duplicate window, stored in `private.settings` (bounded, audited, fail-closed) | Owner decision; one place, adjustable safely |
| 25 | Owner and assistant may both create manual leads | Owner decision |
| 26 | No future-dated activities for now | Owner decision |
| 27 | MFA will be enforced before production launch | Owner decision; `supabase/planned/mfa_enforcement.sql` |
| 28 | Intake credential: prefer Option B (`lead_intake` role), unverified; no silent fallback to the secret key | Owner decision; see `docs/lead-intake-credential.md` |
| 29 | Supabase dashboard: Data API exposes `public` only; "automatically expose new tables" is off; email signups and anonymous sign-ins are off | Owner change, verified from outside on 2026-10-30 (`security-review-phase-1b.md` 5a). Consequence: new tables and functions get no default grant for `service_role` either, so every future migration must grant explicitly what it needs |
| 30 | Public enquiry endpoint is `POST /api/leads` (route handler): origin check, per-client rate limit, size limit, honeypot, strict Zod, Turnstile, then `submit_lead` through an injected submitter. With no submitter it answers 503 and stores nothing | Phase 2. The pipeline is a pure function covered by `npm run test:unit` |
| 31 | The endpoint also rate-limits per client address, in process memory only (never stored, logged or sent to Turnstile) | Phase 2, at the owner's request; revises row 8 ("no IP limiter initially"). Best effort on serverless; the database limits stay authoritative. Added as GDPR question 21 for the adviser |
| 32 | Placeholder content only: project, company, legal and contact text are marked placeholders; `PRIVACY_NOTICE_VERSION = "placeholder-0"` | No real data or legal text has been supplied. The site must not launch with them (launch gate in `docs/gdpr-open-questions.md`) |

See `docs/database.md` for the schema, authorization matrix and open database decisions, and `docs/security-review-phase-1b.md` for the review.

## Deliberately deferred
Hosting provider, domain, notification provider, production Supabase plan, backup method, brand identity.
