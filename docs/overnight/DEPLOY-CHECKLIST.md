# Deploy checklist: GitHub + Render free demo

When this was written, nothing had been done for you: no remote existed, no Render account was used, nothing was pushed or deployed.
*Status 2026-11-01:* the project is pushed to GitHub (`realestatezbonikowski-blip/lodz-real-estate-crm`, branch `main`, initial commit `79716cd`). Render has not been deployed, and no production environment has been deployed or configured. The steps below are kept as written; section 2 notes what is done.
The Render facts below come from general knowledge and the repository itself; **no current Render documentation was fetched**,
so confirm the free-tier limits and the blueprint field names on render.com/docs before relying on them.

## 0. About `render.yaml`
Reviewed against the project: build `npm ci && npm run build` (script exists), start `npx next start -H 0.0.0.0 -p $PORT`
(Next reads `PORT`; binding to 0.0.0.0 is required on Render), `healthCheckPath: /pl` (a static page that returns 200),
`NODE_VERSION: "22"` (package `engines` is `>=20.9`; quoted so it is a string), `plan: free`.
Not verifiable offline: that Render's schema accepts every field exactly as written. If the Blueprint import reports an error,
create the service manually in the dashboard with the same commands.

## 1. Variables (names only; enter values in the Render dashboard)
**Required for the site + enquiries to work**
| Name | Where it is used | Public? |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | enquiry origin validation (`/api/leads` refuses any other origin) and the team-invitation redirect URL | yes, **build time** |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server Supabase client | yes, **build time** |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | same; must be the `sb_publishable_...` key (`proxy.ts` refuses an `sb_secret_` key) | yes, **build time** |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | enquiry form widget (without it the form stays disabled) | yes, **build time** |
| `TURNSTILE_SECRET_KEY` | server verification (without it enquiries return 503) | **secret** |
| `LEAD_INTAKE_DATABASE_URL` | inserts enquiries via `submit_lead` (least-privilege `lead_intake` role) | **secret** |

**Optional**
| Name | Default / effect |
|---|---|
| `MFA_MODE` | unset = `enrolled` (see `MFA.md`); `required` when you decide everyone must enrol; `off` disables enforcement; any other value fails closed to `required` |
| `TRUSTED_PROXY_HEADER` | unset = no per-client login rate limit (only the per-account limit applies). Set it ONLY after verifying which header Render's proxy overwrites |
| `SUPABASE_TEAM_ADMIN_KEY` | server-only secret key that enables team invitations (docs/overnight/TEAM-WORKFLOW.md). Without it the CRM works but cannot invite. Do not reuse `SUPABASE_SECRET_KEY` (intake conflict) |
| `NEXT_PUBLIC_ALLOW_INDEXING` | unset = noindex. Keep unset for a demo |
| `SUPABASE_SECRET_KEY` | fallback intake credential only if `LEAD_INTAKE_DATABASE_URL` is rejected; server-only, never `NEXT_PUBLIC_` |
| `NODE_VERSION` | already in `render.yaml` |

All `NEXT_PUBLIC_*` values are inlined at build time: set them **before** the first build and redeploy after any change.
Run `npm run check:env` locally first (prints names and pass/fail only).

## 2. Git and GitHub
*Status 2026-11-01: steps 1 to 5 are done. The repository `realestatezbonikowski-blip/lodz-real-estate-crm` exists, `origin` is set and `main` was pushed without force as one initial commit, `79716cd`, instead of the several logical commits suggested in step 5.*

1. Create an empty repository on your GitHub account (no README).
2. `git remote add origin <url>`
3. Review what is uncommitted: `git status` (46 paths when this was written). It contained several different bodies of work:
   * public concept redesign (messages, `src/components/concept`, `src/app/[locale]`, `public/concept`, `design-system/`),
   * CRM redesign (`src/features/crm/components`, `src/app/admin/(app)`, `globals.css`),
   * security/MFA (`src/features/mfa`, `src/lib/security`, `src/lib/supabase/cookie-policy.ts`, `src/proxy.ts`, `crm/auth.ts`, login),
   * docs (`docs/`), `render.yaml`.
   The `docs/overnight/` folder and screenshots are optional (about 1 MB).
4. Do NOT commit: `consept/` (17 MB source video/images), `.claude/`, any `.env*` except `.env.example`.
   `.gitignore` already ignores `.env*`; a scan of tracked files found no secret-looking strings.
5. Commit deliberately in logical commits (security/MFA first, CRM redesign, then docs/deploy), then `git push -u origin main`.
   Do not force-push.

## 3. Supabase (dashboard)
1. Auth -> URL Configuration: Site URL = the Render URL; add `https://<service>.onrender.com/**` to Redirect URLs.
2. Confirm TOTP MFA is enabled, the migrations are applied to this project, the owner has a `profiles` row (`docs/dev-migration-runbook.md`).
3. Nothing in this task applied or changed any migration. (Written then. Since 2026-11-01 all six migrations are applied to the dev project; no production project has been migrated or configured.)

## 4. Turnstile (Cloudflare)
Add the Render hostname to the widget's allowed domains; use the production site/secret key pair (not the dummy test keys).

## 5. Render
1. New -> Blueprint -> select the repo (reads `render.yaml`), or New -> Web Service with the commands in section 0.
2. Fill the `sync: false` variables before the first build.
3. Watch the build log for `Compiled successfully` and the start log for `Ready`. Health check: `/pl` returns 200.
4. If the build runs out of memory on the free plan, build locally and use a paid plan for the demo day (cannot be tested here).

## 6. After deploy: smoke test (use test data only)
`/pl`, `/uk`, `/en` load and the hero scrolls; `/pl/contact` shows the widget; submit one clearly-marked TEST enquiry and
delete it in the CRM; `/admin/login` signs in; an account with an enrolled factor is sent to `/admin/mfa`;
wrong code rejected; CRM list opens after the right code.

## 7. Free-tier behaviour for a client demo
Free web services sleep after a period of inactivity (about 15 minutes) and the first request after sleep takes tens of seconds,
and the first load also pulls ~2 MB of hero frames. Open `/pl` and `/admin/login` 2-3 minutes before the meeting, or use an
uptime pinger on a paid plan if the demo must never be cold. Instances have small RAM/CPU, so keep other tabs light on first load.
