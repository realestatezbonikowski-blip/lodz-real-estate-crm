# Real Estate Developer Website + CRM

Public marketing website (PL / UK / EN) and a secure lead-management CRM for a property developer in Łódź, Poland.

Stack: Next.js (App Router), TypeScript, Tailwind CSS, next-intl, Zod, Supabase (Postgres, Auth, RLS).

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in yourself; see docs/supabase-setup.md
npm run dev                  # http://localhost:3000 -> redirects to /pl
```

Checks: `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:db` (database authorization tests, local, no Supabase needed), `npm run check:env` (verifies `.env.local` without printing values), `npm run live:anon` (anonymous checks against the live Supabase project; **do not run until the dev migration is applied**).

## Layout

| Path | Purpose |
|---|---|
| `src/app/[locale]/` | Public multilingual site (`/pl`, `/uk`, `/en`; Polish is default) |
| `src/app/admin/` | CRM (Polish by default with an English option, own theme and language cookies, excluded from locale routing, `noindex`) |
| `src/i18n/` | next-intl routing, request config, navigation helpers, typed messages |
| `src/proxy.ts` | Locale routing (Next.js 16 name for middleware) |
| `messages/` | UI translations. `pl.json` is the type source for all locales |
| `supabase/migrations` | SQL migrations (draft, **not applied to any remote database yet**) |
| `supabase/tests` | Local authorization tests for the migrations |
| `supabase/planned` | SQL for later phases (MFA, least-privilege intake role). **Not migrations**, not applied |
| `scripts/check-env.mjs` | Safe `.env.local` checker |
| `docs/` | `database.md` (schema, permissions, migration procedure), `security-review-phase-1b.md`, `lead-intake-credential.md`, `dev-migration-runbook.md`, `supabase-setup.md`, `decisions.md`, `gdpr-open-questions.md` |

Folders such as `src/features/*` and `src/lib/{supabase,security}` are created when the code that needs them is written.

## Rules

- Never put the Supabase service-role key in client code or `NEXT_PUBLIC_*` variables.
- Never commit `.env*` files (only `.env.example`).
- Legal text and retention periods are not invented here; see `docs/gdpr-open-questions.md`.
