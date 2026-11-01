# Security review of the database design (Phase 1B)

Scope: the three migrations, both test files and the database docs, reviewed without assuming that passing tests mean the design is secure.
Status when this review was written: **nothing had been applied to Supabase.** Sections 1 to 5 come from local tests on an in-process Postgres (PGlite), which is not Supabase. Since then the migrations have been applied to the dev project only (all six, checked 2026-11-01); section 5a records the live results of 2026-10-30. Nothing has been applied to a production project.
Supabase project: development, region **West EU (Ireland), `eu-west-1`**, confirmed by the owner. It must not be changed.

> **Update (Phase 1C):** owner decisions are recorded in `docs/decisions.md` (22–28). Since this review: contact and assignment changes are audited, limits moved to `private.settings`, and Option B was researched against Supabase's connection documentation (`docs/lead-intake-credential.md`). The migration steps are in `docs/dev-migration-runbook.md`. Decisions D2, D3, D4, D5, D6, D7 below are now settled; D1 remains "prefer B, verify".

## 1. Findings

No Critical or High finding in the design as modelled locally. That is a statement about the local model only: several things that matter can only be checked on the real project (section 5).

| ID | Severity | Finding | Status |
|---|---|---|---|
| M1 | Medium | `audit_log.actor_id` was `ON DELETE SET NULL`: deleting a staff account would rewrite who performed past audited actions. Activity authors were also lost the same way. | **Fixed** in `…core_schema.sql` |
| M2 | Medium | Nothing bounded the total number of leads. Turnstile plus the per-email/phone throttle do not stop a flood with varying emails; free-tier storage and the CRM could be filled. | **Fixed**: global circuit breaker in `submit_lead` |
| M3 | Medium | Requirement gap: staff had no authorized way to enter a phone enquiry. | **Fixed**: manual leads (section 4) |
| M4 | Medium | `alter default privileges revoke execute on functions from public` is global (all schemas, including extension installs) and could break unrelated objects. A blanket `revoke … on all functions in schema public` was also unnecessary. | **Fixed**: both removed; replaced by a rule plus a test |
| M5 | Medium | Design risk: the Supabase secret key bypasses RLS, so a leak of it exposes and lets an attacker alter everything, including the audit log. | **Documented**; least-privilege alternative written and tested locally (section 2) |
| M6 | Medium | Test fidelity: PGlite runs as a superuser and imitates Supabase. It cannot show how the real `postgres` role, PostgREST or Auth behave. | **Documented**; live checklist in section 5 |
| L1 | Low | `btrim()` strips only spaces, so tabs, newlines and other control characters passed the name, email and attribution checks. | **Fixed**: control-character checks |
| L2 | Low | `lead_activities.occurred_at` was client-supplied without limit (backdating and future dates). | **Fixed**: may be backdated, never later than `created_at` + 5 minutes |
| L3 | Low | A project's `slug` was editable, but public content and `submit_lead` depend on it. | **Fixed**: slug removed from the update grant |
| L4 | Low | The duplicate throttle is weak by design: `name+tag@` aliases or a changed digit bypass it, two simultaneous requests can both insert, and an attacker who knows a victim's email could cause their submission within 10 minutes to be dropped silently. | **Accepted**, documented. The circuit breaker is the real bound |
| L5 | Low | "Assistant cannot export" cannot be enforced by RLS (assistants may read all leads). | **Accepted**, documented; enforced in the app and audited |
| L6 | Low | Audit gaps: edits to contact details, assignment and archiving are not audited; actions made through the dashboard or secret key are logged with no actor. | **Open decision** (D3) |
| L7 | Low | `assigned_to` may point to a deactivated staff member. | Accepted; the UI should offer active staff only |
| L8 | Low | CSV export can carry spreadsheet formula injection (a name starting with `=`, `+`, `-`, `@`). | **Requirement for Phase 5**: neutralise on export |
| L9 | Low | `referrer` and `landing_path` are stored as supplied. | **Requirement for Phase 3**: strip query strings before storing; render as plain text, never as a link |

Confirmed good (checked in the effective database state, not just the SQL text):
- Every `SECURITY DEFINER` function pins `search_path=""` and uses fully qualified names. All objects share one owner.
- No function in `public` or `private` is executable by `PUBLIC` or `anon`. `authenticated` can execute only the two RLS helpers and `record_lead_export`.
- No policy applies to `anon` or `PUBLIC`. No table forces RLS. No policy is self-referential: the helpers read `profiles` as definer, so there is no recursion.
- Roles come only from `profiles`, never from JWT metadata. An authenticated user without a profile (for example an anonymous sign-in) gets nothing.
- Immutable columns are protected by column-level grants, independent of RLS.

## 2. `public.submit_lead()` and the server-side credential

| Question | Answer |
|---|---|
| `SECURITY DEFINER`? | Yes. It needs to insert into `leads`, where no API role has an insert path for web leads. |
| Owner | The migration role (`postgres` on Supabase). Same as the tables, so the owner bypasses RLS. Verify on the live project. |
| `EXECUTE` | Revoked from `PUBLIC`, `anon`, `authenticated`. Granted to `service_role` only (the current default privileges also show it for that role). Tested. |
| `search_path` | Pinned to empty. All references are schema-qualified. `lower`, `btrim` and `now` are in `pg_catalog`, which is always searched. |
| Can callers bypass spam protection by calling it directly? | Not with the public key or a staff login: they cannot execute it (tested). Only the holder of the server-side credential can. |
| Input validation | Table `CHECK` constraints reject malformed or oversized data, control characters and unknown locales, even if the caller skipped validation. Nulls are rejected. The function trims, lowercases the email and resolves the project slug (active **and** published only). |
| Duplicate throttle | Same email or phone within 10 minutes returns `duplicate` without inserting. |
| Excessive records | A global breaker returns `rate_limited` after 100 web leads in one hour (placeholder; real demand is a handful per day). |
| Return values | `created`, `duplicate`, `rate_limited`, or an error. The public endpoint must map `created` and `duplicate` to the same success message, show a generic try-again-later for `rate_limited`, and never forward database error text. |

**Is it suitable for the planned design?** Yes, for the flow: Next.js endpoint → Turnstile → Zod → `submit_lead`. It is suitable with either credential below.

What the function does and does not protect against: it constrains what the web tier can do by accident or through a bug in the endpoint. It is **not** a defence against someone who holds the secret key, because that key can simply insert rows or read everything without the function.

### Option A: server-only secret key

What a leaked secret key allows: read, change and delete every table (including the audit log), call the Auth admin API (create or delete users), and bypass every policy. It would be a full personal-data breach.

Ways it could leak, and mitigations:

| Vector | Mitigation |
|---|---|
| Bundled into browser code through a `NEXT_PUBLIC_` mistake or a shared import | No `NEXT_PUBLIC_` prefix. One server-only module that starts with `import "server-only"` and exposes only a `submitLead()` function that calls this one RPC. `npm run check:env` already flags secrets in public variables. |
| Logs and error reports | Never log request headers, the client object or caught errors wholesale. Keep personal data and keys out of Sentry. |
| Git, chat, screenshots, CI | `.env*` is git-ignored. Never paste keys into chat. Consider a secret scanner in CI. |
| Preview deployments and developer machines | Use the key only in the Production scope of the host. Use a different Supabase project (and key) for development. |
| Supply-chain code reading `process.env` | Few dependencies. Review new ones. |
| Long-lived exposure | Rotate on any suspicion and on a schedule: create a new key, deploy, revoke the old one. Confirm in the dashboard that individual secret keys can be revoked. |

### Option B: dedicated least-privilege database role (recommended if it works live)

The migration `20261030110000_lead_intake_role.sql` (prepared during this review; since applied to the dev project, see `docs/lead-intake-credential.md`) creates a role `lead_intake` that can execute `submit_lead` and nothing else (no table access, no schema `private`, no bypass of RLS, member of no role). The server connects to Postgres directly with it. A leaked credential could only submit junk leads, which the circuit breaker bounds.

Locally tested: it can submit and is denied on every table, `record_lead_export` and `private`. **Not proven live:** whether a custom role can connect through Supabase's pooler, what the serverless connection behaviour is, and the extra driver dependency. Decide in Phase 3 after a live test; fall back to Option A with the mitigations above. *Update 2026-11-01:* on the dev project the pooler login and the privilege boundary were verified with `npm run verify:intake` (transaction mode 6543 and session mode 5432). Behaviour from the real hosting environment and the remaining manual criteria in `docs/lead-intake-credential.md` are still open.

## 3. RLS policy review

| Check | Result |
|---|---|
| Unauthorized reads/writes | Anonymous: none on any table or function. Inactive staff and users without a profile: no rows, no writes. Tested. |
| Role escalation | Only the owner can write `profiles`; column grants limit it to name, role and active flag; `id` is immutable. No signup trigger creates profiles. The last active owner cannot be removed. Tested. |
| JWT claim assumptions | The only claim used is `sub` (through `auth.uid()`). The planned MFA check adds `aal`. No `user_metadata`. |
| Recursion | None: policies call helpers that read `profiles` as definer. Owner bypass of RLS is what makes this work, so **never** use `FORCE ROW LEVEL SECURITY` (a test guards it). |
| Missing `USING` / `WITH CHECK` | Every update policy has both. Insert policies have `WITH CHECK`. Delete policies have `USING`. |
| Function privileges | Inventory test above. |
| Assistant | Read leads, update leads, add manual leads, add notes. No delete, no project/staff writes, no audit read, no history edits. Tested. |
| Owner-only operations | Delete leads, project writes, staff writes, audit read, export audit. Tested. |
| Audit integrity | No write path for API roles. Written by triggers. Actor survives staff deletion (M1). Limits: L6. |
| Referential integrity | `leads.project_id` RESTRICT; activities cascade with their lead; staff history RESTRICT; `assigned_to`/`created_by` SET NULL. Tested. |

## 4. How each business requirement is supported

| Requirement | Mechanism | Not yet built |
|---|---|---|
| Owner and assistant roles | `profiles.role`; helpers `private.is_owner()` / `is_active_staff()` used by every policy | Staff UI (accounts are created in the dashboard and bootstrapped with SQL) |
| Assistant: leads without deletion or project/staff administration | Policies plus column grants (matrix in `docs/database.md`) | CRM screens |
| Immutable activity history | No UPDATE/DELETE grant or policy; status changes written by trigger; manual types only; authors cannot be deleted (RESTRICT); backdating bounded | Owner correction flow is a decision (D2) |
| Audited owner actions | Triggers write lead delete, project and staff changes; actor kept | Audit viewer; wider coverage is D3 |
| Owner-only exports | The database cannot tell viewing from exporting (L5). The export route must: authenticate with `getUser()`, load the profile and require `owner` (and `aal2` once MFA is enforced), call `record_lead_export(count, scope)` **before** streaming (so an export is never unrecorded), page through results (PostgREST row cap), and neutralise formula injection (L8). `record_lead_export` re-checks ownership inside the database. | Export route (Phase 5) |
| Manual leads from phone enquiries | Staff `INSERT` policy: `source = 'manual'` and `created_by = auth.uid()`; insert limited to name, phone, email, message, project, assignee, locale, source, creator; attribution and notice columns cannot be set; a table constraint keeps manual leads free of web attribution; status changes and history work as for any lead | CRM form. How the privacy notice is given by phone is an open legal question (`docs/gdpr-open-questions.md`) |
| Future MFA | Every policy goes through two helper functions, so `supabase/planned/mfa_enforcement.sql` redefines them to also require `aal = 'aal2'`. Tested locally with simulated claims (aal1 sees nothing, aal2 gets normal permissions, anon and the server path unaffected). Apply only after MFA enrolment/challenge screens exist and every staff member has enrolled. At aal1 the database returns nothing, not even the user's profile, so the login flow must use the Auth API only until aal2. | MFA UI (Phase 4); confirm the real `aal` claim live |

## 5. What local tests cannot prove (needs the live dev project)

Run these after the migrations are applied to the dev project, and record the results here. Several can be done read-only in the SQL editor; the REST checks use only the **publishable** key, never a secret.

1. **Roles and ownership.** Are `postgres`, `authenticator`, `anon`, `authenticated`, `service_role` set up as assumed (`rolsuper`, `rolbypassrls`)? Do tables and functions have the expected owner? The local run uses a superuser, so owner-bypass of RLS inside the helpers is the key behaviour to confirm.
2. **Default privileges.** `pg_default_acl` on the real project (Supabase also defines defaults for other roles that our migration does not touch). Re-run the ACL inventory from `rls.test.mjs` as SQL.
3. **PostgREST.** With the publishable key and no login: `GET /rest/v1/leads` must be refused or empty; `POST /rest/v1/rpc/submit_lead` and `/rpc/record_lead_export` must be refused; `private` functions must not exist as endpoints. Check what status an RLS-filtered `DELETE`/`UPDATE` returns (zero rows affected), because the app must treat that as "forbidden", not success.
4. **Data API settings.** Only `public` is exposed. Check GraphQL exposure, and that no table of ours is in the `supabase_realtime` publication.
5. **Auth.** Signups and anonymous sign-ins are disabled. A user created in the dashboard with no profile gets nothing. After enrolling TOTP, inspect a session JWT to confirm the `aal` claim name and values.
6. **Postgres version and features** used by the migrations on the real server (`gen_random_uuid`, `pg_column_size`, regex classes, identity columns).
7. **Secret key behaviour (Option A)** or **custom-role pooler login (Option B)**.
8. **Dashboard Security Advisor and Performance Advisor.** Expect the two public `SECURITY DEFINER` functions to be reported; they are intentional and self-checking.
9. **Backups.** What the dev plan provides, and a restore test before production.

## 5a. Live results: dev project, 2026-10-30

How: `supabase db query --linked` (read-only SQL via the Management API; role-impersonation probes ran inside `begin read only … rollback`), `supabase db advisors --linked`, and `npm run live:anon` (publishable key, no login). No keys or passwords were printed. Dev project only; **this is not production verification, and nothing here is a GDPR or production-readiness statement.**

| Item (section 5 number) | Result | Evidence |
|---|---|---|
| 1 Roles and ownership | PASS | `anon`/`authenticated` no bypass; `postgres`/`service_role` bypass RLS; no superuser; all 6 tables owned by `postgres`, RLS on, `FORCE` off |
| Function ACLs | PASS | `submit_lead`: `service_role`, `postgres` only. `record_lead_export`: `authenticated`, `service_role`, `postgres`. Two helpers: `authenticated`, `postgres`. All other private functions: owner only. No `PUBLIC` entry. All definer functions `search_path=""` |
| `anon` privileges | PASS | 0 table grants, 0 column grants, 0 executable functions; probes as `anon` refused (`permission denied`) for `leads`, `submit_lead`, `record_lead_export`, schema `private` |
| `authenticated` grants | PASS | Matches the migration. Nothing on `private.settings`. `leads` INSERT = exactly the 10 intended columns; UPDATE = the 9 intended. `profiles`/`projects` INSERT lists every column because the grant is table-level; RLS restricts it to the owner |
| Policies | PASS | 15 policies, all `TO authenticated` |
| Signed-in user without a profile | PASS | `is_active_staff()` and `is_owner()` false; `record_lead_export` raises `forbidden`; `submit_lead` and `private.settings` refused |
| Foreign-key delete rules | PASS | As documented in section 1 of `docs/database.md` |
| 2 Default privileges | PASS for our objects, informational otherwise | `postgres` defaults in `public` grant only `postgres` and `service_role`. `supabase_admin` defaults in `public` still grant `anon`/`authenticated`/`service_role`, but apply only to objects `supabase_admin` creates (none exist) |
| 3 PostgREST (anonymous) | PASS | `npm run live:anon`: reads of the 5 tables HTTP 401; direct lead insert 401 (empty body, cannot create a row); `rpc/submit_lead` and `rpc/record_lead_export` 404; `rpc/is_owner` 404. Row counts afterwards: `leads` 0, `audit_log` 0. Not checked: what status an RLS-filtered `UPDATE`/`DELETE` returns for staff (needs a staff login) |
| 4 Realtime | PASS | No rows from `public`/`private` in the publication |
| 4 GraphQL | PASS (extension absent) | `pg_graphql` is not installed (extensions: `pg_stat_statements`, `pgcrypto`, `plpgsql`, `supabase_vault`, `uuid-ossp`) |
| 6 Postgres version | PASS | PostgreSQL 17.11; all four migrations applied without error |
| Settings | PASS | `intake.max_web_leads_per_hour` = 100, `intake.duplicate_window_minutes` = 10 |
| Migration history | PASS | Four rows, matching `supabase/migrations/` |
| 8 Advisors | PASS, as expected | One WARN: `authenticated` can execute `public.record_lead_export` (intentional, owner-checked inside). INFO: `private.settings` RLS without policy (intentional), `leads_created_by_fkey` without a covering index, 10 unused indexes on empty tables |
| Accepted risk M2 | CONFIRMED, not changed | `service_role` has select/insert/update/delete on `audit_log` and `lead_activities` (Supabase default grants). "Append-only" holds for `anon`/`authenticated` only. Whether to revoke from `service_role` is deferred to the Option A/B decision |

**Dashboard changes verified from outside (2026-10-30, after the owner changed them):** anonymous `GET` requests with the publishable key and `Accept-Profile: <schema>` returned HTTP 401 for `public` (reached the permission check) and HTTP 406 `PGRST106` (schema not exposed) for `private`, `graphql_public`, `storage`, `auth` and `extensions`. `/auth/v1/settings` reported `disable_signup: true`, anonymous sign-ins `false`, `mailer_autoconfirm: false`. The "automatically expose new tables" change is visible in `pg_default_acl`: for objects created by `postgres` in `public`, `anon` and `authenticated` get nothing and `service_role` lost its default select/insert/update/delete on tables (now `Dxtm` only), its default execute on functions, and its default sequence usage. Existing objects keep their earlier grants. Defaults for `supabase_admin` in `public` still list `anon`/`authenticated`, but apply only to objects that role creates (none). Still not checked: TOTP availability.

**Defect found and fixed:** `record_lead_export` accepted a NULL `p_scope`. Fixed by `20261030100000_record_lead_export_null_scope.sql` (new migration, applied to dev after a dry-run listed only it). Regression test: the export test in `rls.test.mjs` now also rejects a NULL scope and a NULL row count. The test failed before the fix. After applying: the live function body contains the NULL check and its ACL and owner are unchanged.

**Still unverified:**
- Auth dashboard settings: email signups disabled; anonymous sign-ins disabled; TOTP available (item 5).
- Data API exposed schemas: only `public` (item 4). The Advisor confirms `public` is exposed; `private` was not probed through REST.
- Staff behaviour with real accounts: assistant/owner permissions through the API, the status returned by an RLS-filtered `UPDATE`/`DELETE`, the real `aal` claim after TOTP enrolment (items 3 and 5).
- Option A secret-key behaviour and Option B pooler login (item 7). *(Option B pooler login: verified on dev on 2026-11-01 with `npm run verify:intake`; Option A behaviour is still untested.)*
- Backups and a restore test (item 9).
- The first owner has not been created; `profiles` is empty.

## 6. Proposed safe migration procedure (for later approval)

Steps 1–7 below have been done for the **dev project** (the migration set was four files at that point; it is now six, all applied to dev as of 2026-11-01). Steps 8 onward are not done. Each remaining step needs your explicit go-ahead.

1. Decide D1–D3 and Option A or B for intake (section 7).
2. Review the three migration files and the two `planned/` files once more. Optionally commit locally (only when you ask me to).
3. Run `npm run test:db` and `npm run check:env`. Confirm the target is the dev project in `eu-west-1`.
4. Add the Supabase CLI as a dev dependency and run `supabase init`. Review the generated `config.toml`. No remote action.
5. Log in and link the project, typing the database password yourself. Compare the project ref and region shown with the dashboard.
6. Run `supabase db push --dry-run` and read the exact list of migrations.
7. Apply to **dev only** with `supabase db push`.
8. Create the first owner: create the Auth user in the dashboard, then bootstrap the profile with SQL (template in `docs/database.md`).
9. Run the live checklist (section 5) and record results in this file.
10. Fix any difference as a **new** migration. Never edit an applied migration.
11. Only after a clean dev result, plan production as a separate project built from the same files.

Rollback for dev: drop the objects in reverse order, or delete and recreate the dev project (everything is in git). Never roll back a project that holds real data by dropping; write a forward migration.

## 7. Remaining decisions

| ID | Decision | Current default |
|---|---|---|
| D1 | Option A (secret key) or Option B (`lead_intake` role) | Decide in Phase 3 after a live test; B preferred if it works |
| D2 | Can the owner correct or delete a single note? | No. Corrections are new notes; erasure = delete the lead |
| D3 | Audit edits of contact details, assignment and archiving? | Not audited. Status changes are already in history |
| D4 | Hourly cap (100) and duplicate window (10 minutes) | Placeholders; tune after seeing real traffic |
| D5 | May an assistant add manual leads? | Yes (both roles) |
| D6 | Future-dated activities (for example a scheduled meeting) | Not allowed. A "scheduled" feature would need its own design |
| D7 | Confirm `aal` handling and MFA rollout date | Phase 4 |
