# What must be supplied before launch

Everything below is currently a **marked placeholder** or fails closed. Nothing here has been invented. The site is `noindex` until `NEXT_PUBLIC_ALLOW_INDEXING=true` is set deliberately.

## 1. Content and facts (from the developer)

| Item | Where it goes | Today |
|---|---|---|
| Developer name, identity, mission | `messages/*.json`: `Nav.brandPlaceholder`, `Home.identity*`, `Footer.companyPlaceholder` | Bracketed placeholders |
| Company details, address, phone, email, contact hours | `Contact.*`, `Footer.*` | `[Do uzupełnienia]` |
| Confirmed project facts: number of apartments, storeys, completion date, pricing | `src/features/projects/data.ts` → `facts[].value` | `null`, shown as "Do potwierdzenia". The figures mentioned in conversation (four floors plus a garage level, about 15–20 apartments) are **unverified and deliberately not published** |
| Project description and status | `messages/*.json`: `Projects.items.<slug>.summary`; `status` in `data.ts` | Placeholder; status `planning` is a provisional default |
| Project name and slug | `Projects.items.radomska.name`, slug `radomska` | **Confirmed**: the name is "Radomska 5" and the slug is `radomska` |
| Confirmation of the street address as shown on the site | `messages/*.json` wherever the address is shown (for example `Home.*`) | Pending: the address wording on the site is not yet confirmed by the developer |
| Apartment list (areas, floors, availability, prices) | New `units` data in `data.ts` plus a table on the project page | Section says it will be published after approval |
| Visualisations, sketches, floor plans, photographs | `data.ts` → `media[]` with `src`, `width`, `height`, and `alt` for pl/uk/en, files under `public/` | Labelled placeholder cards. The label (Wizualizacja / Szkic / Rzut / Zdjęcie) is always shown; never present a render as a photograph |
| Brand identity: logo, typeface, final palette | `src/app/globals.css` tokens, `src/lib/fonts.ts`, `src/app/icon.svg` | Provisional limestone/ink/terracotta/stone system and Cormorant Garamond + Inter |

## 2. Legal (data controller and legal adviser; see `docs/gdpr-open-questions.md`)

Items 1, 2, 4 and 6 are launch gates. Also: the real privacy notice text and version (`PRIVACY_NOTICE_VERSION` in `src/features/leads/config.ts` is `"placeholder-0"`), the `/privacy` page, a consent checkbox only if the adviser requires one, retention periods, processor agreements (Supabase, hosting, Cloudflare), cookie/analytics decision (none are used today), and the transient-memory rate limiting (item 21).

## 3. Accounts, credentials and configuration

| Variable / task | Where | Who |
|---|---|---|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (public) and `TURNSTILE_SECRET_KEY` (server only) | `.env.local` / hosting secret store | You, after creating a Cloudflare Turnstile widget for the real domain |
| `LEAD_INTAKE_DATABASE_URL` (server only) | `.env.local` / hosting secret store | You, only after the Option B steps in `docs/lead-intake-credential.md` pass. User must be `lead_intake.<project-ref>`; `npm run check:env` verifies the shape without printing it. Dev status 2026-11-01: set in `.env.local` and `npm run verify:intake` passed; the other criteria in that file are still open, and no hosting environment has been configured yet |
| `NEXT_PUBLIC_SITE_URL` | Real domain (used for the Origin check) | You |
| Apply `20261030110000_lead_intake_role.sql` to the dev project | Remote change | Done on the dev project with your approval (applied 2026-10-30, confirmed 2026-11-01); a production project would need its own approval (exact operation in `docs/lead-intake-credential.md`) |
| Set the `lead_intake` password and enable login | psql `\password lead_intake`, then `alter role lead_intake with login` | You, never in chat or in git. Done on dev with `npm run setup:intake` (it replaced the psql route); a production project would need its own |
| A `projects` row with slug `radomska`, `is_active` and `is_published` true | Database (after the first owner exists) | Owner. Created and verified on the dev project on 2026-11-01 (name "Radomska 5", city "Łódź", status `planning`); a production project needs its own row |
| First owner account, then MFA enrolment | Runbook Stage 5, `supabase/planned/mfa_enforcement.sql` | You |
| Hosting provider, domain, production Supabase project, backups | Deployment | You |
| Native-speaker review of the Ukrainian and English text | `messages/uk.json`, `messages/en.json` | Reviewer |

## 3b. Admin CRM: what is verified and what needs the first owner

Built and tested locally: server-side login, role check from `profiles`, leads list with status counts, search (name, e-mail, phone), filters (status, project, source, assignee, archive), lead detail, status change, assignment, notes/calls/e-mails/meetings, contact edit, archive/restore, manual leads, owner-only delete. Unit and structural tests pass; screens were checked in headless Chrome with fake data (desktop, tablet, phone).

**Not verified live** (written when no staff account existed; one active owner profile has since been seen on the dev project, 2026-11-01, but this smoke test is not recorded as done): sign-in, the real PostgREST reads and writes of these screens, and the status codes of RLS-filtered writes. After the owner exists (runbook Stage 5), a short smoke test is needed: sign in; create a manual lead; change its status (a `status_change` row must appear in the history); add a note; assign; archive and restore; confirm the lead shows up in the list; sign out; confirm `/admin/leads` redirects to login. Then create an assistant and confirm that the delete section is hidden and a direct delete is refused. MFA is not enforced yet (`supabase/planned/mfa_enforcement.sql`); it is a pre-production requirement.

## 3c. MFA (TOTP): built, not enforced

Built and tested locally: `/admin/security` and `/admin/mfa`, a pure policy (`src/features/mfa/policy.ts`), a rate-limited verification flow and server-validated state loading. Verified in the real runtime (production build, real forms, a fake auth server): enrolment with QR and manual key, wrong and correct codes, the challenge, no redirect loops, a hostile `?next` replaced, removal needing confirmation plus a fresh code, the per-account rate limit, and cookie attributes preserved after the aal2 upgrade.

**Not verified against the real Supabase project** (needs you, with your own authenticator app): the first enrolment, that the `aal`/`amr` claims in a real token look as assumed (an `aal2` session after verification, a `totp` entry with a timestamp), that removing a verified factor from an aal2 session works, and that an aal2 session survives a token refresh. Suggested manual test, in this order, and use a second device as backup before removing anything: sign in; open **Bezpieczeństwo**; add the app and confirm with a code; check the page now says "aal2"; sign out and in; open the security page and use "Zweryfikuj tę sesję kodem"; confirm it returns to aal2. Do **not** remove your only factor during this test.

Not done on purpose: enforcement in `requireStaff()`/`requireOwner()`, the database helpers, step-up for deleting leads, and the break-glass runbook (audit steps 5-9). Recovery codes are not offered or claimed: the installed client has an experimental API for them, but support on this project is unverified. Remaining Dashboard decisions: minimum password length and leaked-password protection (Free plan: likely unavailable, unverified), session time-box/inactivity limits (the owner reports "Limit duration of AAL1 sessions" is ON; its duration was not checked).

## 4. Production strategy notes

- **Login brute-force protection (implemented, per process).** `src/lib/security/login-guard.ts` counts every sign-in attempt before the password is checked and gives it back on success: **5 attempts per 15 minutes per client** (only when a trusted client address is known) and **10 per 15 minutes per account** (keyed by a keyed hash of the e-mail, never stored raw). Blocked attempts never reach Supabase Auth, blocks end by themselves, there is no shared/global bucket, and unknown and existing accounts behave identically. Client addresses come only from the header named in `TRUSTED_PROXY_HEADER`, and only if it is a valid IP; IPv6 is keyed by /64; nothing is trusted by default (the previous code used a spoofable `X-Forwarded-For` and a shared "unknown" bucket, which let anyone lock out all logins; the public enquiry endpoint had the same flaw and now uses the same helper). Verified live against a local fake auth server with the real login form: header spoofing did not bypass it; the correct password was refused while blocked; other clients and accounts were unaffected.
  - **Still required before production (cannot be done in application memory):** counters live in one process, so a restart clears them and N instances allow up to N times the limits. Add a platform rate-limit rule on `POST /admin/login` (for example a Cloudflare rate-limiting rule or the host's equivalent, which also stops floods before they reach Next.js) or a shared store (Redis/Upstash, or a table in Postgres, which needs a migration), set `TRUSTED_PROXY_HEADER` to the header the host overwrites, enable Supabase Auth leaked-password protection if the plan allows it, and turn on MFA. Supabase Auth's own limits are keyed on the address of our server (all sign-ins come from it), so they act as one shared budget; our guard keeps most abuse from reaching it, but a distributed attacker could still exhaust it. Known trade-off: someone who knows the owner's e-mail can make that one account wait up to 15 minutes by failing 10 times.
- **Public-endpoint rate limiting.** `src/lib/security/rate-limit.ts` is per server instance, in memory. On a multi-instance or serverless host it only slows bursts on one instance. The authoritative limits are in the database (`submit_lead`: duplicate window and hourly cap) and Turnstile. Recommended addition when the domain is on Cloudflare (needed for Turnstile anyway, no new paid service): a Cloudflare rate-limiting rule for `POST /api/leads`. A shared store (for example Redis) is not justified at 15–20 apartments.
- **Alerting.** The endpoint emits `rate_limited_by_database`, `submit_error` and `intake_unavailable` events (currently `console.warn`, no personal data). Wire them to the owner's chosen notification channel (open question 18).
- **Content-Security-Policy.** Enforced in production only (`next.config.ts`): same-origin by default plus Cloudflare Turnstile. It allows `'unsafe-inline'` scripts because Next.js emits inline bootstrap scripts; a nonce policy would make every page dynamic. Tested in headless Chrome with the real Turnstile widget (Cloudflare's dummy test key): no CSP violations were logged. The Turnstile *server-side* verification was not exercised live, only through unit tests with a mocked response.
- **Option A is not implemented.** `SUPABASE_SECRET_KEY` is detected by `check:env` and `resolveIntakeMode` but the endpoint never uses it.

## 5. Design and motion decisions (provisional until the brand is approved)

- Light, warm "limestone" paper with ink text, one terracotta accent and a single deep-stone panel; display type is Cormorant Garamond, body Inter (both include Polish and Ukrainian glyphs). All colours pass WCAG AA (computed ratios in `globals.css`).
- The hero art is an abstract composition that deliberately depicts no building, floors or windows, and is captioned "Ilustracja abstrakcyjna. Nie przedstawia projektu."
- Motion follows the installed `emil-design-eng` guidance: custom ease-out curves, UI feedback under 300 ms, press scale on buttons, hover effects only for fine pointers, transitions rather than keyframes for interactive UI, clip-path image reveal, reduced-motion support. Section reveals use CSS scroll-driven animation (no JavaScript, no layout shift; browsers without support show the content). `motion` (Framer Motion's successor) is used only for the hero parallax and the mobile menu. **GSAP/ScrollTrigger was not added**: it would duplicate what these two libraries already do and add weight without a feature that needs it (no pinned or timeline-scrubbed sections were designed).
- Not measured: Core Web Vitals (LCP, CLS) have **not** been measured; no performance target is claimed.
