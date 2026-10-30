# Runbook: applying the migrations to the DEVELOPMENT Supabase project

Status (dev project): **Stages 1–4 done** (CLI installed and linked; the first three migrations applied; the fourth, `20261030100000_record_lead_export_null_scope`, applied on 2026-10-30 after a dry-run that listed only it). **Stage 6a/6b partly done** (read-only inventory, role-impersonation probes in read-only transactions, Advisors, `npm run live:anon`); results are in `docs/security-review-phase-1b.md` section 5a. **Not done:** Stage 5 (first owner), 6c, the dashboard Auth/Data API checks, Option B. Each remaining stage needs your explicit go-ahead. For a fresh project (for example production) the steps below apply as written, with all four migrations.
Target: development project, West EU (Ireland), `eu-west-1`. Never run this against a production project.

Rules for the whole procedure
- You type the database password yourself, in your own terminal. It never goes into chat, source code, a file in the repo, or a command-line flag (`--password` ends up in shell history).
- Applied migrations are never edited. A mistake is fixed by a new migration.
- Stop at the first unexpected output and report it. Do not "try something else".

## Stage 0: preconditions (all must be true)

- [ ] `npm run test:db` passes on exactly the files you are about to apply (98 tests at the time of writing).
- [ ] `npm run lint`, `npm run typecheck`, `npm run build` pass.
- [ ] You have read the files in `supabase/migrations/` (four at the time of writing) once more. **The dry-run prints only migration file names, not their SQL**, so this reading is the real review.
- [ ] In the Supabase dashboard: Authentication → email signups are **disabled**; anonymous sign-ins are **disabled**.
- [ ] `.env.local` exists; `npm run check:env` is all ✔.
- [ ] You can see the dev project's region (`eu-west-1`) and project ref in the dashboard, and the project contains **no data you care about**.
- [ ] Optional but recommended: commit the work locally first (I will do this only when you ask) so the applied files are identifiable.

## Stage 1: install and initialise the CLI (local only, no network call to your project)

```powershell
npm install supabase --save-dev
npx supabase --version
npx supabase init
```

- **Done (Phase 1D):** `supabase@2.122.0` is installed as a dev dependency. npm reported no install script for the `supabase` package, so no approval was needed; the three pending script warnings (`@parcel/watcher`, `@swc/core`, `unrs-resolver`) predate it and remain unapproved.
- **Done:** `supabase init` created only `supabase/config.toml` and `supabase/.gitignore`; existing files were byte-identical afterwards.
- The CLI needs Node 20+ (you have 24). Scoop is the alternative on Windows.
- `supabase init` creates `supabase/config.toml` and does not contact Supabase. Review it. Do not add keys or passwords to it. It must not be able to overwrite `supabase/migrations/` or `supabase/tests/` (check the diff afterwards).

## Stage 2: log in and link the development project

```powershell
npx supabase login
npx supabase link --project-ref <the 20-character ref from your project URL>
```

- `login` authenticates the CLI to your Supabase account (browser flow or an access token; an access token is a secret, never paste it into chat).
- Before linking, compare the ref you type with the dashboard URL character by character. After linking, confirm in the dashboard that this project is the development one in `eu-west-1`.
- **Password entry.** The CLI's `--help` (v2.122.0) documents only a `--password` flag and no environment variable. Do not use the flag. Let the CLI prompt you in your own terminal and type the password there (it is not echoed). If a command fails because it needs a password and does not prompt, stop and tell me; do not work around it by putting the password in a flag, a file or an environment variable I have not verified.
  Not allowed: `--password` on the command line, putting the password in `.env.local` or any file, or pasting it anywhere I can see.
- Run `npx supabase projects list` after login: it shows each project's name, ref and region. Pick the development project in `eu-west-1` and confirm its ref to me before linking.
- After linking, run `git diff --stat supabase/config.toml`; `link` must not have changed it. Do **not** run `supabase config push`: the generated local `config.toml` has permissive local defaults (for example `enable_signup = true`, minimum password length 6) that must never be pushed to the real project.
- Linking records the project ref locally (under `supabase/.temp`, which is git-ignored). Check `git status` shows no new tracked secret.

## Stage 3: dry run (reads remote migration history, changes nothing)

```powershell
npx supabase db push --dry-run --linked --skip-vault
```

`--skip-vault` matters: per the CLI help, `db push` otherwise updates Vault secrets from `config.toml` before migrations. `--linked` makes the target explicit. Never add `--include-all`, `--include-seed`, `--include-roles`, `--db-url` or `--password`. The CLI will ask for the database password; type it there.

Inspect the output:
- On a fresh project it should list **exactly four** migrations, in this order: `20261029120000_core_schema`, `20261029120100_security_policies`, `20261029120200_submit_lead`, `20261030100000_record_lead_export_null_scope`. On a project that already has some applied, it lists only the rest. Anything else (extra migrations, "already applied", a different project) is a stop.
- It does not show SQL and does not validate permissions. Per Supabase's CLI reference the real run also creates the history table `supabase_migrations.schema_migrations` on first use.
- `supabase/planned/` files are not listed (they are not in `migrations/`). If they appear, stop.

## Stage 4: apply (needs your explicit go-ahead after Stage 3)

```powershell
npx supabase db push --linked --skip-vault
```

- If it errors partway, stop, copy the error text (no secrets) and send it to me. Do not rerun repeatedly.
- Recovery for the dev project: delete and recreate the project, or drop the created objects in reverse order (see `docs/database.md`, section 6). Never edit a migration that has applied.

## Stage 5: create the first owner (manual, in the dashboard)

1. Dashboard → Authentication → Users → add a user with the owner's email and a strong password (auto-confirm for this first user). Note the user's UUID.
2. Dashboard → SQL editor, run **once**, with the real UUID and name (this is deliberately not a migration, so no personal data enters git):
   ```sql
   insert into public.profiles (id, full_name, role)
   values ('<auth user uuid>', '<full name>', 'owner');
   ```
3. Confirm: `select id, full_name, role, is_active from public.profiles;` shows one active owner, and `select action, actor_id from public.audit_log;` shows one `staff.create` row with no actor (expected: made in the SQL editor).
4. Create the assistant the same way later with `'assistant'`, only when needed.
5. MFA is not enforced yet. Enrol a TOTP factor for the owner as soon as the CRM has the screen; enforcement (`supabase/planned/mfa_enforcement.sql`) is a pre-production requirement.

## Stage 6: verify against the real project

Record each result in `docs/security-review-phase-1b.md` section 5.

**6a. Database inventory (read-only).** Run the statements in `supabase/tests/live_inventory.sql` one at a time in the SQL editor and compare with the `EXPECT` comments. This checks owners, `search_path`, `EXECUTE` ACLs (no `PUBLIC`), table and column grants, policies, foreign-key rules, default privileges set by Supabase, the realtime publication, the two settings, and server version.

**6b. Anonymous Data API checks (no login).** After you decide to run it:
```powershell
npm run live:anon
```
It sends requests with only the publishable key and prints status codes: reading each table, inserting a lead, calling `submit_lead` and `record_lead_export`, and calling a private helper must all be refused. It prints no keys and no response bodies.

**6c. Staff checks (with test accounts, a separate step).** Using a throwaway assistant and owner: assistant cannot delete a lead, change a role, write a project or read the audit log; a user without a profile sees nothing; owner can. Check what HTTP status an RLS-filtered `UPDATE`/`DELETE` returns (expected: success with zero rows, which the app must treat as "forbidden"). This needs the CRM login or a small script and is planned for Phase 4.

**6d. Settings that tests cannot see.** Data API exposes only `public`; GraphQL exposure; Security Advisor and Performance Advisor (the two public `SECURITY DEFINER` functions will be reported and are intentional); the real `aal` claim after TOTP enrolment; Postgres version and extensions.

**6e. Option B pass criteria** (`docs/lead-intake-credential.md`) are a separate, later stage and need a new migration for the role.

## Stage 7: close out

- Record the results, deviations and the exact applied commit (when committed) in `docs/security-review-phase-1b.md`.
- Log out of the CLI session or remove the access token if you do not need it (`npx supabase logout`).
- Only then plan Phase 2/3. Production is a separate project built from the same files.

## Changing an operational limit later

The hourly cap and the duplicate window live in `private.settings` only. To change one deliberately:
```sql
update private.settings set int_value = 50 where key = 'intake.max_web_leads_per_hour';
```
Run it as the project owner in the SQL editor (or in a migration so it is in git). The database refuses values outside safe bounds (cap 1–1000, window 1–1440 minutes), and every change is written to `audit_log` as `settings.update` with the key and old/new value. Neither value is repeated in function code, app code or tests.
