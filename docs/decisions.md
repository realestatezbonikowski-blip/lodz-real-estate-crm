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
| 33 | Provisional visual system (limestone/ink/terracotta/stone, Cormorant Garamond + Inter); motion via CSS scroll-driven reveals plus `motion` for hero parallax and the mobile menu; no GSAP | Phase 2 design. Brand not confirmed, so everything is tokenised. See `docs/content-needed.md` section 5 |
| 34 | Option B prepared locally: role moved from `supabase/planned/` into migration `20261030110000_lead_intake_role.sql` (not applied), adapter `postgres-submitter.ts` using `postgres`, wired only when `LEAD_INTAKE_DATABASE_URL` is set | Owner preference for Option B. Remote apply, password and live verification still need explicit approval |
| 35 | Production-only enforced CSP (same-origin + Cloudflare Turnstile, `'unsafe-inline'` scripts) and `noindex` until `NEXT_PUBLIC_ALLOW_INDEXING=true` | Placeholder content must not be indexed; a nonce CSP would force dynamic rendering |
| 36 | Multi-instance rate limiting: database limits and Turnstile stay authoritative; add a Cloudflare rate-limit rule at deployment; no shared store | See `docs/content-needed.md` section 4 |
| 37 | `lead_intake` role applied to DEV (NOLOGIN, no password) with the owner's approval on 2026-10-30; credential created by the owner via `npm run setup:intake`, never by the assistant | Keeps the password out of chat, logs and SQL history |
| 38 | Admin CRM: server-side auth with `@supabase/ssr` and the publishable key only; role from `profiles`; `requireStaff()`/`requireOwner()` on every page and server action; a write filtered out by RLS is reported as a failure; no browser Supabase client | Phase 4. The proxy only refreshes sessions and redirects; it is not the security boundary |
| 39 | Login brute-force protection: attempts counted up front and given back on success; per-client (trusted address only) 5/15 min and per-account 10/15 min; client addresses only from `TRUSTED_PROXY_HEADER`; no shared bucket; in-memory only, so a platform rate-limit rule or shared store is required before production | Replaces a spoofable, globally-lockable limiter (audit M2). See `docs/content-needed.md` section 4 |
| 40 | MFA, steps 2-3 of the audit plan: pure fail-closed policy (`src/features/mfa/policy.ts`) and the TOTP screens `/admin/security` (enrol, list, remove with re-authentication) and `/admin/mfa` (challenge). **Built but NOT enforced**: `requireStaff()`/`requireOwner()`, RLS and the database functions are unchanged and `supabase/planned/mfa_enforcement.sql` is not applied, so users without a factor log in as before. The screens read no application table, decide only from server-validated claims (`getUser()` + signature-verified `getClaims()`), and rate-limit code attempts (5 wrong codes per account / 10 per trusted client per 15 min). Recovery codes are not offered; a lost authenticator needs a second enrolled device or manual intervention. Dashboard facts confirmed by the owner: TOTP enabled, 10 factors per user, phone MFA off, Free plan | Replaces audit gaps G1 (no UI) and prepares G2/G3. Rollout steps 5-9 need separate approval |

See `docs/database.md` for the schema, authorization matrix and open database decisions, and `docs/security-review-phase-1b.md` for the review.

## Deliberately deferred
Hosting provider, domain, notification provider, production Supabase plan, backup method, brand identity.
