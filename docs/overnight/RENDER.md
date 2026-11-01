# Render free demo: readiness

**Status: prepared, NOT deployed.** There is no git remote and no Render account access here, so no deployment was attempted and
no URL exists. `render.yaml` (repo root) is a Blueprint for one free Web Service.

## What the app needs
* One Node web process (`next start`), no background worker, no persistent disk, no local files beyond the build output.
  `public/concept` (4.6 MB) ships with the repo.
* Supabase (Auth + Postgres + RLS) as the backend. It is not replaced.
* Build: `npm ci && npm run build` (Node 22 via `NODE_VERSION`). Start: `npx next start -H 0.0.0.0 -p $PORT`.
  Health check: `/pl`.

## Environment variable NAMES (values go only in the Render dashboard)
| Name | Kind | Notes |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | public, **build time** | `https://<service>.onrender.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | public, **build time** | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public, **build time** | the `sb_publishable_...` key only |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | public, **build time** | Cloudflare Turnstile site key (add the Render hostname to the widget's allowed domains) |
| `TURNSTILE_SECRET_KEY` | secret, server | enquiries are refused with 503 without it |
| `LEAD_INTAKE_DATABASE_URL` | secret, server | least-privilege `lead_intake` role (docs/lead-intake-credential.md); alternative `SUPABASE_SECRET_KEY` only if that is rejected |
| `MFA_MODE` | server | `enrolled` (default), `required`, `off` |
| `TRUSTED_PROXY_HEADER` | server, optional | leave unset unless you have verified which header Render's proxy overwrites |
| `NEXT_PUBLIC_ALLOW_INDEXING` | public, optional | keep unset: the site stays noindex |

`NEXT_PUBLIC_*` values are baked in at build time: set them BEFORE the first deploy and redeploy after changing them.
Never put the Supabase service/secret key in a `NEXT_PUBLIC_` variable.

## Supabase dashboard steps (manual)
1. Auth -> URL Configuration: Site URL = the Render URL; add it (and `/**`) to Redirect URLs.
2. Confirm TOTP MFA is enabled; the owner account exists with a `profiles` row (docs/dev-migration-runbook.md).
3. The migrations must already be applied to the project you point at (Phase 1-4 are; the `lead_intake` role too).

## Free-tier behaviour to expect (from general knowledge of Render's free web services; verify on render.com/docs/free)
Services spin down after ~15 minutes without traffic, so the first request after idle takes tens of seconds; limited RAM/CPU;
a monthly free-hours allowance. Open the site once before a client meeting to wake it. The scroll hero loads ~2 MB of frames
progressively, which is fine on free hosting but slow on the very first cold request.

## Steps for you
1. Create a GitHub repository you own, `git remote add origin <url>`, push the intended commit(s) (review `git status`: the
   working tree still holds uncommitted security/CRM work that must be committed deliberately).
2. Render -> New -> Blueprint -> pick the repo (reads `render.yaml`), fill the `sync: false` values, deploy.
3. Do the Supabase and Turnstile steps above, then open `/pl`, `/admin/login` and test an enquiry and an MFA sign-in.

> Full step-by-step checklist (GitHub, variables, Supabase, Turnstile, smoke test): `DEPLOY-CHECKLIST.md`.
