# Overnight mission: final report

Nothing was committed, amended, pushed or reset. HEAD is still `588cdfd`. All mission changes are uncommitted, on top of the
earlier uncommitted security/MFA/CRM work, which was preserved.

## 1. Executive summary
* **MFA bug found and fixed**: enforcement was never wired into `requireStaff()`. Enrolled users are now challenged before any CRM
  page or action works (details: `MFA.md`).
* **CRM redesigned** ("Graphite Console"): dark graphite theme, illuminated navigation tabs, mobile drawer, KPI cards from real
  counts, restyled filters/rows/forms/status colours; all workflows unchanged.
* **Public site**: mobile pass on the Radomska 5 concept; one overflow regression I introduced was caught by the test suite and fixed.
* **Render**: `render.yaml` + `RENDER.md` prepared. **Not deployed** (no git remote, no Render access).
* Checks: lint, typecheck, 198/198 unit, 98/98 database, production build: all passing. Browser suites: 31 + 34 + redesign suite, 0 failures.

## 2. Files changed in this mission
New: `src/features/crm/components/CrmNav.tsx`, `render.yaml`, `docs/overnight/*`.
Edited: `src/features/crm/auth.ts` (MFA gate), `src/features/mfa/state.ts` (optional known-user param, saves a round trip),
`src/features/mfa/guards.test.ts` (superseded assertion replaced), `src/app/admin/(app)/layout.tsx` (new shell),
`src/features/crm/components/LeadsView.tsx` (KPI cards, tabs, rows), `src/app/globals.css` (CRM theme + components),
`src/components/concept/ApartmentExplorer.tsx` (mobile level scroller, `min-w-0` fix), `src/components/concept/IsoLocation.tsx` (label size).
No migration, RLS, Supabase, rate-limit or lead-submission file was touched.

## 3. CRM design improvements
* Tokens: the admin `<html class="crm">` remaps the shared tokens to graphite surfaces, brass accent, and re-tinted semantic status colours,
  so every existing component (fields, buttons, badges, messages) adapts without per-component rewrites.
* Navigation: tabs with a rising glow, a single light sweep and an accent border on hover (pointer devices only, CSS only, behind
  `prefers-reduced-motion`), an inset accent bar for the active tab, visible focus ring, pressed state for touch.
  Verified: hover glow applies, one active tab, keyboard ring visible, sweep disabled under reduced motion.
* Mobile: menu button + drawer with 52 px rows, sign-out inside, Escape closes, closes on navigation, `aria-expanded`.
* Dashboard: four KPI links (all / new / meetings / converted) using the real `statusCounts`; no invented metrics.
  Status tabs scroll horizontally on phones. Rows are lit-edge cards with touch feedback.
* Contrast sweep of every CRM page: 0 text nodes below AA (89 + 68 + 19 + 21 checked).

## 4. Public-site improvements
Hero choreography and the whole concept were delivered in the previous session; this pass verified them on mobile and fixed
the apartment level selector (horizontal scroller on phones) and an overflow bug it introduced (grid child needed `min-w-0`).

## 5. Responsive results (headless Chrome emulation, not real devices)
Public home in pl/uk/en and CRM list/detail/new/security checked at 320, 360, 390, 430 (CRM), 768, 1024 (CRM), 1280, 1440:
no horizontal overflow. Public hero checked at 390x800 and 390x568.

## 6. MFA
See `MFA.md`. Browser-verified against a local fake Supabase Auth only.

## 7. Render readiness
See `RENDER.md` and `render.yaml`. Prepared, not deployed, no URL.

## 8. Environment variable NAMES
`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`,
`TURNSTILE_SECRET_KEY`, `LEAD_INTAKE_DATABASE_URL` (or `SUPABASE_SECRET_KEY` as the fallback option), `MFA_MODE`,
optional `TRUSTED_PROXY_HEADER`, `NEXT_PUBLIC_ALLOW_INDEXING`.

## 9. Git
Branch `main`, HEAD `588cdfd`, no remotes, working tree has uncommitted changes (earlier work + this mission). Nothing pushed.

## 10. Test results
| Check | Result |
|---|---|
| ESLint | clean |
| `tsc --noEmit` | clean |
| Unit (incl. translation parity) | 198 / 198 (baseline 197; +1 from the replaced MFA guard tests) |
| Database | 98 / 98 |
| Production build | passes |
| Browser: hero/sequence suite | 31 pass, 0 fail |
| Browser: public redesign suite (contrast, locales, filters, no-JS, blocked frames, reduced motion, routes) | 0 fail |
| Browser: CRM + MFA suite | 34 pass, 0 fail |
One real regression was found by the suites mid-way (public overflow at <= 768 px) and fixed before the final run.

## 11. Known limitations
* MFA and CRM were exercised against a fake Auth/REST server, not the live Supabase project.
* Real-device and Safari/Firefox testing not done. The scroll-driven CSS effects need a recent Chromium/Safari.
* The CRM has no charts: there is not enough real data to justify them; KPI cards are real counts only.
* Lead detail/forms were re-themed via tokens, not individually redesigned.
* Screenshots use fixture people/addresses (`example.com`), not real customers.
* Render free-tier behaviour is stated from general knowledge; web docs were not consulted.
* Sample apartment data and the 30%/25-year financing remain explicitly unconfirmed concept content.

## 12. Steps for you
1. Decide `MFA_MODE` (`enrolled` now; `required` when you want everyone enrolled), enrol the owner and assistant in `/admin/security`.
2. Create a GitHub repo, add the remote, review `git status`, commit deliberately, push.
3. Deploy via Render Blueprint per `RENDER.md`; set Supabase redirect URLs and the Turnstile domain.

## 13. Run locally
`npm run dev` (needs `.env.local`), or `npm run build && npm start`. Open `/pl` and `/admin/login`.
Screenshots: `docs/overnight/screenshots/`.
