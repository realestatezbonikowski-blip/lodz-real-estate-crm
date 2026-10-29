# Security review of the database design (Phase 1B)

Scope: the three migrations, both test files and the database docs, reviewed without assuming that passing tests mean the design is secure.
Status: **nothing has been applied to Supabase.** All results below come from local tests on an in-process Postgres (PGlite), which is not Supabase.
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

`supabase/planned/lead_intake_role.sql` creates a role `lead_intake` that can execute `submit_lead` and nothing else (no table access, no schema `private`, no bypass of RLS, member of no role). The server connects to Postgres directly with it. A leaked credential could only submit junk leads, which the circuit breaker bounds.

Locally tested: it can submit and is denied on every table, `record_lead_export` and `private`. **Not proven live:** whether a custom role can connect through Supabase's pooler, what the serverless connection behaviour is, and the extra driver dependency. Decide in Phase 3 after a live test; fall back to Option A with the mitigations above.

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

## 6. Proposed safe migration procedure (for later approval)

Nothing below has been done. Each step needs your explicit go-ahead.

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
