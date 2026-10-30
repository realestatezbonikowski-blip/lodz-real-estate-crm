# Database and security design (Phase 1A, revised in Phase 1B; draft for review)

Status: **migrations are written, tested locally, and applied to the DEVELOPMENT Supabase project only (West EU / Ireland). Nothing has been applied to a production project.** Live checks on the dev project are recorded in [`security-review-phase-1b.md`](security-review-phase-1b.md) section 5a; several checks are still unverified (listed there).
The independent review, findings, secret-key analysis and live-test checklist are in
[`security-review-phase-1b.md`](security-review-phase-1b.md). Dev project region: West EU (Ireland), `eu-west-1`.

Not migrations, not applied: `supabase/planned/mfa_enforcement.sql` (future MFA requirement) and
`supabase/planned/lead_intake_role.sql` (least-privilege intake role, Option B).

Migrations (`supabase/migrations/`, applied in filename order):

| File | Content |
|---|---|
| `20261029120000_core_schema.sql` | Enums, tables, constraints, indexes, `updated_at` trigger, RLS enabled on every table |
| `20261029120100_security_policies.sql` | Revokes Supabase's default grants, helper functions, triggers, RLS policies, column grants, `record_lead_export` |
| `20261029120200_submit_lead.sql` | `public.submit_lead()`, executable by `service_role` only |
| `20261030100000_record_lead_export_null_scope.sql` | Fix found in review: `public.record_lead_export()` accepted a NULL `p_scope` (`NULL not in (...)` is NULL, and an `IF` treats that as false). Redefines only that function; its owner and grants are unchanged. Applied to dev after the first three. |

## 1. Schema

| Table | Purpose | Key points |
|---|---|---|
| `profiles` | One row per staff member (`id` = `auth.users.id`) | `full_name`, `role` (`owner`/`assistant`, default `assistant`), `is_active`. Email stays in `auth.users` and is not duplicated. |
| `projects` | One row per development | Unique `slug` (public content in code is keyed by it), `name`, `city`, `status` (`planning`/`selling`/`completed`), `is_active` (in use in CRM), `is_published` (selectable on the public form) |
| `leads` | Enquiries | `first_name`, `last_name`, `phone`, `email`, optional `message`, optional `project_id`, `status` (7 values), `assigned_to`, `source` (`web_form` or `manual`), `created_by` (manual leads), `locale`, `utm_source/medium/campaign`, `landing_path`, `referrer`, `privacy_notice_version` (required for web leads, empty for manual), `created_at`, `updated_at`, `archived_at` |
| `lead_activities` | Append-only contact history | `type` (`note`/`call`/`email`/`meeting`/`status_change`), `body`, `from_status`/`to_status` (status changes only), `occurred_at`, `created_at`, `actor_id` |
| `audit_log` | Append-only record of sensitive actions | `actor_id`, `action`, `entity_type`, `entity_id`, small `details` (max 1 KB, no personal data), `occurred_at` |

Design choices worth reviewing:

- **No IP address, user agent or other extra personal data** is stored. Fields are exactly those of the agreed form plus attribution.
- **Foreign keys.** `leads.project_id` is `RESTRICT` (a project with leads cannot be deleted; archive it instead). `lead_activities.lead_id` is `CASCADE` (deleting a lead removes its history, which an erasure request needs). `leads.assigned_to` and `created_by` are `SET NULL`. `lead_activities.actor_id` is `RESTRICT`, so a staff member who recorded anything is deactivated, not deleted. `audit_log.actor_id` is deliberately not a foreign key, so deleting a staff account can never rewrite who did what.
- **Text hygiene.** Single-line fields reject control characters (`btrim` only strips spaces). Messages and notes may contain line breaks but no other control characters. Activity `occurred_at` may be backdated but not set in the future.
- **`archived_at`** is justified because assistants cannot delete leads. It lets them hide dead leads, and it supports retention workflows once periods are decided.
- **Status changes are logged by a database trigger**, not by the app. Nobody can insert a `status_change` activity directly, so that history cannot be forged.
- **Immutable after creation:** `id`, `locale`, UTM fields, `landing_path`, `referrer`, `privacy_notice_version`, `created_at`. Enforced by column-level grants, which are independent of RLS. `updated_at` is set by a trigger.
- **Constraints** are the last line of defence if a caller skips validation: trimmed names, phone and email format, length caps, `locale in (pl, uk, en)`, slug format.
- **Roles are never read from user-editable JWT metadata.** They come only from `profiles`.
- **No trigger creates a profile on signup.** Such a trigger is a classic privilege-escalation route. Signups are also disabled in Auth.
- **Lock-out protection:** the last active owner cannot be demoted, deactivated or deleted.
- **Indexes** serve the CRM list (status, project, date, assignee) and the duplicate throttle (email, phone). Name search needs no index at this scale (about 15–20 apartments).

## 2. Authorization matrix (enforced by RLS plus grants)

`—` means the operation is denied. "Active" means `profiles.is_active = true`. Anonymous visitors and inactive users get nothing anywhere.

| Resource | Owner | Assistant |
|---|---|---|
| Read leads | ✅ | ✅ |
| Create web-form lead directly | — (only `submit_lead`) | — |
| Create a manual lead (phone enquiry), attributed to self | ✅ | ✅ |
| Update lead: contact fields, message, project, status, assignee, archive | ✅ | ✅ |
| Update immutable lead fields | — | — |
| Delete lead | ✅ (audited) | — |
| Read activities | ✅ | ✅ |
| Add note/call/email/meeting (as self) | ✅ | ✅ |
| Add `status_change` activity / edit / delete activity | — | — |
| Read projects | ✅ | ✅ |
| Create/update/delete projects (slug is immutable) | ✅ (audited) | — |
| Read staff list (name, role, active flag) | ✅ | ✅ |
| Create/update/delete staff profiles, change roles | ✅ (audited) | — |
| Read audit log | ✅ | — |
| Write audit log directly | — | — |
| Record a CSV export (`record_lead_export`) | ✅ | — (raises `forbidden`) |

Limits to be honest about:

- **"Assistant cannot export" cannot be enforced by RLS.** Assistants legitimately read all leads, and the database cannot tell viewing from exporting. The restriction lives in the application (the export route authorizes the owner only) and in the audit record of each export. An assistant can still read leads one page at a time through the normal CRM.
- **All active staff can read the staff list** (name, role, active flag; no email). It is needed to show "assigned to" and activity authors. It is a one-line policy change if you want it stricter.

### Audit coverage (what is recorded, by whom, where)

Nobody with an API role can insert, change or delete audit records or history (no grants, no policies). Rows are written by database triggers or by `record_lead_export`, which re-checks ownership. The actor is the staff member's profile id from the session; actions made through the service role or the SQL editor are recorded with no actor.

| Event | Where recorded | What is stored |
|---|---|---|
| Lead status change | `lead_activities` (append-only history, written by trigger) | lead, from/to status, actor, time. Not duplicated in `audit_log` |
| Lead contact-detail change (first name, last name, phone, email) | `audit_log` `lead.update_contact` | lead id, actor, **names of the changed fields only**. Never old or new values |
| Lead assignment change | `audit_log` `lead.assign` | lead id, actor, previous and new assignee (staff ids) |
| Lead deletion (owner) | `audit_log` `lead.delete` | lead id, actor |
| Project create/update/delete (owner) | `audit_log` `project.*` | project id, actor |
| Staff create, role/active change, delete (owner) | `audit_log` `staff.*` | staff id, actor, role and active flag before/after |
| Lead export (owner, when built) | `audit_log` `lead.export` via `record_lead_export` | row count, scope (`all` or `filtered`), actor |
| Change of an operational limit | `audit_log` `settings.update` | setting key, old and new number |

Not audited by design (so they are not silently assumed): edits to the message, project, archive flag, and the creation of manual leads (the lead carries `source` and `created_by`).

### Operational limits (one place)

`private.settings` holds `intake.max_web_leads_per_hour` (default 100, allowed 1–1000) and `intake.duplicate_window_minutes` (default 10, allowed 1–1440). `public.submit_lead` reads them; nothing else repeats the numbers (a test enforces that). The table is in the unexposed `private` schema with no API grants. Changes are made by the project owner in the SQL editor or in a migration, are range-checked by the database, are audited, and if a row is missing `submit_lead` fails closed. How to change one: `docs/dev-migration-runbook.md`, last section.

## 3. How public lead submission will work (not yet implemented)

```
Browser form ──POST──► Next.js server endpoint (Phase 3)
                         1. Verify Cloudflare Turnstile token (server-side)
                         2. Check the honeypot field
                         3. Validate and normalise with Zod
                         4. Call public.submit_lead(...) with the server-only credential
                              ├─ checks the project is active AND published
                              ├─ 10-minute throttle on repeated email/phone
                              ├─ global cap of 100 web leads per hour ('rate_limited')
                              └─ inserts the lead (table constraints re-check the data)
                         5. Same success response for 'created' and 'duplicate';
                            a generic "try again later" (and an alert) for 'rate_limited'
```

The server-only credential is either the secret key (Option A) or a least-privilege database role (Option B).
Risks, mitigations and the choice are analysed in [`security-review-phase-1b.md`](security-review-phase-1b.md), section 2.

- Leads have **no INSERT policy or grant** for `anon` or `authenticated`. `submit_lead` is executable by `service_role` **only**, so calling it directly with the public key fails (tested). Turnstile and validation therefore cannot be bypassed through the database API.
- **Trade-off to accept consciously:** this requires a server-only Supabase secret key (`service_role` equivalent). It bypasses RLS entirely, so a leak is serious. Mitigations: one small server-only module, `import "server-only"`, never a `NEXT_PUBLIC_` variable, stored only in the hosting provider's secret store, rotated if exposed. My earlier idea of an anon-callable function was rejected because anyone with the public key could call it and skip Turnstile.
- Any privileged operation re-checks the caller explicitly: server code calls `supabase.auth.getUser()` and verifies the role before acting. `record_lead_export` re-checks ownership inside the database.

## 4. Tests

Run: `npm run test:db` (98 tests in `rls.test.mjs` and `hardening.test.mjs`, about 2 minutes). They apply the real migration files to an in-process Postgres (PGlite) with `supabase/tests/supabase_stub.sql`, which imitates Supabase's roles, `auth.uid()`, `auth.jwt()` and permissive default grants, then act as each kind of user. The `planned/` SQL files are tested the same way but are not migrations.

What they cover: anonymous access to every table and function; assistant attempts to delete leads, change roles (own and others'), create or re-key staff, manage projects, read or write the audit log, forge or edit history and change immutable fields; inactive users and users without a profile; the `submit_lead` flow, throttle and constraint rejections; owner capabilities and their audit rows; last-owner protection; and a privilege inventory (RLS on every table, no anon policy, no anon table or function privilege, no automatic exposure of newly created objects).

The tests were also run against deliberately weakened copies of the migrations (assistant allowed to delete, default grants kept, `anon` allowed to call `submit_lead`, last-owner guard disabled, flood cap removed, audit actor made a foreign key, manual-lead creator check removed, editable slug, future-dated activities allowed, control-character check removed, activity author deletable) and failed each time, so they do detect regressions.

What they do **not** prove:

- They run on PGlite (Postgres 18), not on Supabase. Check the project's Postgres version in the dashboard.
- They do not exercise PostgREST, Supabase Auth, MFA, the Data API's exposed-schema setting, or GraphQL.
- The stub is my imitation of Supabase defaults. Re-run the key checks once against the real dev project (section 5, step 8).

## 5. Migration application procedure (dev project only, after approval)

Do not apply to a production project. Nothing here has been done yet.

1. Confirm the target is the **dev** project: URL and project ref match `docs/supabase-setup.md`.
2. Confirm `npm run test:db` passes on the exact files to be applied, and the working tree is committed or at least reviewed.
3. `npx supabase init` (creates `supabase/config.toml`; review it, nothing remote happens).
4. `npx supabase login`, then `npx supabase link --project-ref <ref>`. You enter the database password yourself in the terminal; never paste it into chat.
5. `npx supabase db push --dry-run --linked --skip-vault` and read the list of migrations it would apply. It should list exactly the migrations in `supabase/migrations/` that the target has not applied yet, in filename order (a fresh project: all four); anything else is a stop. It prints file names only, not SQL, so the real review is reading the files. `--skip-vault` is needed because `db push` otherwise updates Vault secrets from `config.toml`. Do not use `--password`, `--db-url`, `--include-all`, `--include-seed` or `--include-roles`, and never run `supabase config push`.
6. Only after a separate explicit go-ahead: `npx supabase db push --linked --skip-vault`. If it errors partway, stop and report the error text instead of re-running. See `docs/dev-migration-runbook.md` (Stages 3 and 4), which is the authoritative procedure.
7. Dashboard → Auth: signups disabled; create the first user. Then bootstrap the owner in the SQL editor (this is deliberately not a migration):
   ```sql
   insert into public.profiles (id, full_name, role)
   values ('<auth user uuid>', '<name>', 'owner');
   ```
8. Verify on the real project: run Dashboard → Advisors (Security) and read the findings (the two `SECURITY DEFINER` functions in `public` are intentional and self-checking); confirm only the `public` schema is exposed by the Data API; with the publishable key and no login, confirm a `GET /rest/v1/leads` returns an error or empty result and `POST /rest/v1/rpc/submit_lead` is refused.

## 6. Backup and rollback considerations

- **Rollback.** Supabase migrations have no automatic "down". For the dev project the safe rollback is to drop the objects in reverse order (functions and triggers, policies, tables `audit_log`, `lead_activities`, `leads`, `projects`, `profiles`, types, schema `private`) or to delete and recreate the dev project, since all structure is in git. On a project holding real data, never roll back by dropping; write a forward migration.
- **Before any migration on a project with data:** take a backup first and test that it restores.
- **Backups.** Free-plan projects have no scheduled backups that count as production protection (verify the current plan terms in the dashboard). Before launch, either a paid plan with daily backups or a scheduled `pg_dump` to storage you control, plus a **tested restore**. Backups also contain personal data: their retention interacts with erasure requests (see `docs/gdpr-open-questions.md`).
- **Dev project may be paused or deleted** after inactivity on the free tier; treat it as disposable.
- **Production** should be a **separate** Supabase project created from the same migrations, not the dev project promoted.

## 7. Decisions

**Decided by the owner (Phase 1C):** activity history stays append-only; contact-detail and assignment changes are audited; 100 web leads per hour and a 10-minute duplicate window are the initial defaults, held in `private.settings`; owner and assistant may both create manual leads; future-dated activities are not allowed; MFA will be enforced before production launch; Option B (dedicated intake role) is preferred but unverified (`docs/lead-intake-credential.md`).

**Still open** (the table below was written before these decisions; rows 2, 3, 4, 5 are now settled as stated above):

None of these block applying the migrations to the dev project. Defaults are what the SQL does today.

| # | Decision | Current default |
|---|---|---|
| 1 | Should assistants see all staff names and roles? | Yes (needed for assignee and author display) |
| 2 | Require MFA (`aal2`) inside RLS | Not yet. Add when the MFA enrolment screen exists (Phase 4), otherwise staff can be locked out |
| 3 | Can the owner delete or correct a single note? | No, history is append-only. Corrections are new notes. Erasure = delete the lead |
| 4 | Can staff create a lead manually (for example a phone enquiry)? | Yes, both roles, as `source = 'manual'` attributed to themselves (database side done; CRM form later) |
| 5 | Duplicate throttle window | 10 minutes, a design value |
| 6 | Project status names (`planning`/`selling`/`completed`) and lead locales | Placeholders from my proposal. Confirm with the owner |
| 7 | Staff account creation flow | Dashboard plus the SQL bootstrap above. A UI later needs a server action that checks the caller is an owner and then uses the Auth admin API |
| 8 | Secret key handling for intake | Server-only key as described in section 3. Confirm you accept it |
| 9 | Retention, consent record, referrer and UTM storage, backups | Open legal questions, see `docs/gdpr-open-questions.md` |
