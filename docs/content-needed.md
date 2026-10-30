# What must be supplied before launch

Everything below is currently a **marked placeholder** or fails closed. Nothing here has been invented. The site is `noindex` until `NEXT_PUBLIC_ALLOW_INDEXING=true` is set deliberately.

## 1. Content and facts (from the developer)

| Item | Where it goes | Today |
|---|---|---|
| Developer name, identity, mission | `messages/*.json`: `Nav.brandPlaceholder`, `Home.identity*`, `Footer.companyPlaceholder` | Bracketed placeholders |
| Company details, address, phone, email, contact hours | `Contact.*`, `Footer.*` | `[Do uzupełnienia]` |
| Confirmed project facts: number of apartments, storeys, completion date, pricing | `src/features/projects/data.ts` → `facts[].value` | `null`, shown as "Do potwierdzenia". The figures mentioned in conversation (four floors plus a garage level, about 15–20 apartments) are **unverified and deliberately not published** |
| Project description and status | `messages/*.json`: `Projects.items.<slug>.summary`; `status` in `data.ts` | Placeholder; status `planning` is a provisional default |
| Whether "Rodomska" is the public name and the address | `Projects.items.rodomska.name`, slug `rodomska` | Working name only |
| Apartment list (areas, floors, availability, prices) | New `units` data in `data.ts` plus a table on the project page | Section says it will be published after approval |
| Visualisations, sketches, floor plans, photographs | `data.ts` → `media[]` with `src`, `width`, `height`, and `alt` for pl/uk/en, files under `public/` | Labelled placeholder cards. The label (Wizualizacja / Szkic / Rzut / Zdjęcie) is always shown; never present a render as a photograph |
| Brand identity: logo, typeface, final palette | `src/app/globals.css` tokens, `src/lib/fonts.ts`, `src/app/icon.svg` | Provisional limestone/ink/terracotta/stone system and Cormorant Garamond + Inter |

## 2. Legal (data controller and legal adviser; see `docs/gdpr-open-questions.md`)

Items 1, 2, 4 and 6 are launch gates. Also: the real privacy notice text and version (`PRIVACY_NOTICE_VERSION` in `src/features/leads/config.ts` is `"placeholder-0"`), the `/privacy` page, a consent checkbox only if the adviser requires one, retention periods, processor agreements (Supabase, hosting, Cloudflare), cookie/analytics decision (none are used today), and the transient-memory rate limiting (item 21).

## 3. Accounts, credentials and configuration

| Variable / task | Where | Who |
|---|---|---|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (public) and `TURNSTILE_SECRET_KEY` (server only) | `.env.local` / hosting secret store | You, after creating a Cloudflare Turnstile widget for the real domain |
| `LEAD_INTAKE_DATABASE_URL` (server only) | `.env.local` / hosting secret store | You, only after the Option B steps in `docs/lead-intake-credential.md` pass. User must be `lead_intake.<project-ref>`; `npm run check:env` verifies the shape without printing it |
| `NEXT_PUBLIC_SITE_URL` | Real domain (used for the Origin check) | You |
| Apply `20261030110000_lead_intake_role.sql` to the dev project | Remote change | Needs your explicit approval (exact operation in `docs/lead-intake-credential.md`) |
| Set the `lead_intake` password and enable login | psql `\password lead_intake`, then `alter role lead_intake with login` | You, never in chat or in git |
| A `projects` row with slug `rodomska`, `is_active` and `is_published` true | Database (after the first owner exists) | Owner |
| First owner account, then MFA enrolment | Runbook Stage 5, `supabase/planned/mfa_enforcement.sql` | You |
| Hosting provider, domain, production Supabase project, backups | Deployment | You |
| Native-speaker review of the Ukrainian and English text | `messages/uk.json`, `messages/en.json` | Reviewer |

## 4. Production strategy notes

- **Rate limiting.** `src/lib/security/rate-limit.ts` is per server instance, in memory. On a multi-instance or serverless host it only slows bursts on one instance. The authoritative limits are in the database (`submit_lead`: duplicate window and hourly cap) and Turnstile. Recommended addition when the domain is on Cloudflare (needed for Turnstile anyway, no new paid service): a Cloudflare rate-limiting rule for `POST /api/leads`. A shared store (for example Redis) is not justified at 15–20 apartments.
- **Alerting.** The endpoint emits `rate_limited_by_database`, `submit_error` and `intake_unavailable` events (currently `console.warn`, no personal data). Wire them to the owner's chosen notification channel (open question 18).
- **Content-Security-Policy.** Enforced in production only (`next.config.ts`): same-origin by default plus Cloudflare Turnstile. It allows `'unsafe-inline'` scripts because Next.js emits inline bootstrap scripts; a nonce policy would make every page dynamic. Tested in headless Chrome with the real Turnstile widget (Cloudflare's dummy test key): no CSP violations were logged. The Turnstile *server-side* verification was not exercised live, only through unit tests with a mocked response.
- **Option A is not implemented.** `SUPABASE_SECRET_KEY` is detected by `check:env` and `resolveIntakeMode` but the endpoint never uses it.

## 5. Design and motion decisions (provisional until the brand is approved)

- Light, warm "limestone" paper with ink text, one terracotta accent and a single deep-stone panel; display type is Cormorant Garamond, body Inter (both include Polish and Ukrainian glyphs). All colours pass WCAG AA (computed ratios in `globals.css`).
- The hero art is an abstract composition that deliberately depicts no building, floors or windows, and is captioned "Ilustracja abstrakcyjna. Nie przedstawia projektu."
- Motion follows the installed `emil-design-eng` guidance: custom ease-out curves, UI feedback under 300 ms, press scale on buttons, hover effects only for fine pointers, transitions rather than keyframes for interactive UI, clip-path image reveal, reduced-motion support. Section reveals use CSS scroll-driven animation (no JavaScript, no layout shift; browsers without support show the content). `motion` (Framer Motion's successor) is used only for the hero parallax and the mobile menu. **GSAP/ScrollTrigger was not added**: it would duplicate what these two libraries already do and add weight without a feature that needs it (no pinned or timeline-scrubbed sections were designed).
- Not measured: Core Web Vitals (LCP, CLS) have **not** been measured; no performance target is claimed.
