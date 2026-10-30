# Lead intake credential: Option A vs Option B (decision record)

Status (2026-10-30): **the `lead_intake` role exists on the DEV project (migration `20261030110000_lead_intake_role.sql` applied with the owner's approval) but cannot log in and has no password. The pooler connection is NOT yet verified.** Verified live right after applying: `login=false`, not superuser, no BYPASSRLS, no role memberships, connection limit 5, `statement_timeout=5s`, `search_path=''`, `EXECUTE` on `public.submit_lead` only (no other function in `public` or `private`), `USAGE` on schema `public` only (not `private`), no privilege on any table.
Owner decision (recorded): prefer Option B, but do not assume it works until verified.

## 1. The problem

`public.submit_lead()` is the only way a web lead is stored. Browsers, `anon` and `authenticated` cannot run it. So the Next.js server needs *some* credential that can. That credential decides how bad a leak is.

## 2. Option B: dedicated `lead_intake` database role

File: `supabase/migrations/20261030110000_lead_intake_role.sql` (prepared and tested locally; **not applied to any project**; it was moved from `supabase/planned/` so the tests cover the exact file that would be pushed). The server adapter is `src/features/leads/server/postgres-submitter.ts` and is wired in `src/app/api/leads/route.ts` only when `LEAD_INTAKE_DATABASE_URL` is set, which must happen only after the live pass criteria below.

### How the role would authenticate

It does **not** use the Data API (PostgREST), an API key or a JWT. It is a normal Postgres `LOGIN` role with a password, used over a direct SQL connection from the Next.js server.

Credential required: **one password** (for `lead_intake`), stored only as a server-only connection string in the hosting provider's secret store (variable name reserved in `.env.example`: `LEAD_INTAKE_DATABASE_URL`). Never `NEXT_PUBLIC_`, never in git, never in chat.

### Compatibility with Supabase's connection options

From Supabase's connection documentation (read during this review; **not tested**):

| Connection | Host / port | Username | IP | Usable for this? |
|---|---|---|---|---|
| Direct | `db.<ref>.supabase.co:5432` | `postgres` documented | IPv6 on Free/Pro; IPv4 needs an add-on | Poor fit: serverless hosts are often IPv4-only. Custom-role username form not documented for it. |
| Shared pooler, session mode | `…pooler.supabase.com:5432` (host from the Connect dialog) | `<role>.<project-ref>` | IPv4 | Possible |
| **Shared pooler, transaction mode** | same host, port **6543** | `<role>.<project-ref>` | IPv4 | **Recommended by Supabase for serverless**; prepared statements must be disabled in the driver |
| Dedicated pooler | `db.<ref>.supabase.co:6543` | `postgres` documented | IPv6 (IPv4 add-on) | Paid tier; custom-role form not documented |

The documentation states that a custom role connects through the shared pooler as `<role>.<project-ref>`. Supabase's own examples show it working. **However**, public community threads report custom login roles failing through the pooler (for example "Tenant or user not found", or connection requests dropped from the queue), with no confirmed cause or fix in those threads. Another report attributes a failure to Supabase's automatic network bans. So Option B is *documented as possible* and *reported to fail for some people*. That is exactly why it must be proven on the dev project.

TLS: use at least `sslmode=require`; prefer `verify-full` with Supabase's root certificate.

### What the role can and cannot do (proven locally on PGlite only)

- Can: execute `public.submit_lead` and nothing else.
- Cannot: read or write any table, create objects, read `private.settings`, execute `record_lead_export`, bypass RLS, or inherit from any role. Tests: `supabase/tests/hardening.test.mjs` ("planned least-privilege intake role" and "function privileges are explicit").

### Residual risks of Option B (even if it works)

- A leaked password lets an attacker submit junk leads, bounded by the hourly cap. That cap is itself a nuisance: an attacker could fill it and make real leads return `rate_limited` until the hour passes. Mitigation: alert on `rate_limited`, rotate the password.
- Every Postgres role can read system catalogs (table and function *names*, not data) and use temporary tables. Accepted.
- Failed logins may trigger Supabase's automatic network bans, which could block the hosting provider's shared egress IP. To be checked.
- The password rotates by `\password lead_intake` in psql plus a hosting-secret update; the pooler may briefly reject logins after a change (reported). Plan a quiet window.
- Adds a Postgres driver dependency to the app (for example `postgres`) and connection-string handling.

### Pass criteria (all must hold on the dev project before adopting B)

1. `lead_intake` created by a migration as `NOLOGIN`; login enabled and password set by you with psql `\password` (so the plaintext never appears in a statement or query history).
2. Connect from your machine through the shared pooler, transaction mode (6543), as `lead_intake.<ref>`, TLS on, prepared statements off. `select current_user` returns `lead_intake`.
3. `select public.submit_lead(...)` with clearly fake data returns `created`; the fake lead is then removed by you as the project owner.
4. Negative checks as `lead_intake`: `select` on `leads`, `create table`, `record_lead_export`, `private.settings` are all denied.
5. Session mode (5432) also works as a fallback transport.
6. Reconnect after at least 10 idle minutes; five concurrent connections; behaviour is stable.
7. Rotate the password once; confirm new connections work and old ones fail.
8. Confirm one deliberate wrong-password attempt does not lock out the machine (do **not** repeat failed attempts).
9. In Phase 3, repeat 2–3 from the real hosting environment.

### Verification plan and current blocker (2026-10-30)

Known without any remote change: the linked project's shared pooler host is `aws-0-eu-west-1.pooler.supabase.com` (recorded by the CLI in `supabase/.temp/pooler-url`, no password in it); the Postgres server is 17.11; the role's privileges are already proven locally (`hardening.test.mjs`).

Update (Phase 2 implementation): steps 1 and the adapter below are now prepared locally. The migration exists and is covered by the local tests (the role is `NOLOGIN`, has no password, connection limit 5, `statement_timeout` 5s, and can execute `submit_lead` only). `postgres` (postgres.js) was added as the driver; the adapter uses no prepared statements, a pool of 2 and TLS `require`. `npm run check:env` validates the connection-string shape without printing it. A read-only `supabase db push --dry-run --linked --skip-vault` lists exactly this one pending migration. Nothing was applied.

**Approval request (remote change), exact operation:** `npx supabase db push --linked --skip-vault` applying `20261030110000_lead_intake_role.sql` to the DEV project. Impact: creates one cluster-level role `lead_intake` (NOLOGIN, cannot connect); no table, function or policy changes; no data touched. Rollback: `revoke execute on function public.submit_lead(text,text,text,text,text,text,text,text,text,text,text,text,text) from lead_intake; revoke usage on schema public from lead_intake; drop role lead_intake;` (run as the project owner; nothing depends on the role while it has no login).

What remains needs remote changes, so it has not been started:
1. A new migration creating `lead_intake` `NOLOGIN` (a copy of the planned file; the planned file would then be removed and the local tests adjusted, because the tests currently apply the planned file on top of the migrations). Nothing is created until you approve the exact file.
2. You set the password and enable login yourself with psql `\password lead_intake`, then `alter role lead_intake with login`. I cannot do this safely: it needs a password only you may know, and running it through the Management API would put the plaintext into a statement.
3. You add `LEAD_INTAKE_DATABASE_URL` to `.env.local`.
4. A verification script (needs a Postgres driver such as `postgres`, not installed yet) then runs pass criteria 2, 4, 5 and 6 without printing the URL. Criterion 3 creates a fake lead, which is a remote write and needs a separate go-ahead; you remove it as owner.

### Credential setup (run by you; nothing is typed into chat)

`psql` is not installed on this machine, so the documented `password` route is replaced by a script that does the same thing: `scripts/setup-intake-credential.mjs`. It generates a 32-byte random password locally, sends only its **SCRAM-SHA-256 verifier** in `alter role lead_intake with login password '<verifier>'` (this is what `password` sends; the verifier format is covered by a test against the RFC 7677 vector and was confirmed to be stored verbatim by Postgres), writes `LEAD_INTAKE_DATABASE_URL` (transaction-mode pooler, port 6543, user `lead_intake.<ref>`) to `.env.local` without printing it, and refuses to run if the variable already exists. If the file write fails it switches login off again.

In your terminal, in the project folder:

```powershell
npm run setup:intake -- --check   # optional: validates the preconditions, changes nothing (already run once: passes)
npm run setup:intake              # type YES when asked
npm run check:env                 # shape checks only (user, host, port); prints no values
npm run verify:intake             # read-only checks through the real pooler
```

`verify:intake` connects as `lead_intake`, confirms `current_user` and the 5 s timeout, confirms it can execute `submit_lead` (without calling it), confirms reads of `leads` and `profiles`, `private.settings`, `create table`, `record_lead_export` and `private.is_owner` are all refused with SQLSTATE 42501, then repeats the connection on the other pooler mode (5432 / 6543). It stops at the first login failure and does not retry (repeated failures can trigger Supabase's network bans). It creates no lead.

Not covered by that script, still manual: idle reconnect after 10 minutes, five concurrent connections, password rotation (criteria 6 and 7), and the first real lead. **No real lead will be created without your explicit go-ahead for that test.** Never put the URL in chat; for deployment copy it from `.env.local` into the host's secret store yourself.

## 3. If Option B cannot be used safely

**Do not silently fall back to the secret key.** The Phase 3 code will read exactly one credential variable:
`LEAD_INTAKE_DATABASE_URL` (Option B) **or** `SUPABASE_SECRET_KEY` (Option A), and refuse to start if both or neither are set. If Option B's connection fails at runtime, intake returns an error and alerts; it never retries with the secret key.

The safest practical alternative is **Option A with compensating controls**, adopted only by an explicit entry in `docs/decisions.md`:

| Control | Why |
|---|---|
| Key exists only in the Production scope of the host's secret store; the development project uses a different key | Limits exposure |
| One server module (`import "server-only"`) exposing only `submitLead()`, which only calls this RPC | Limits what code can reach the key |
| No logging of headers, clients or caught error objects; no personal data in error reports | Keys and PII leak through logs |
| Alerts on `rate_limited` and on unusual lead volume | Detects abuse and misuse |
| Rotation on suspicion and on a schedule; confirm individual secret keys can be revoked | Limits exposure time |
| Secret scanning in CI; `npm run check:env` before every deploy | Catches mistakes |
| Few dependencies; review new ones | Supply-chain risk |

## 4. Other options considered and rejected

| Idea | Why not |
|---|---|
| `submit_lead` callable by `anon` with the public key | Anyone could call it directly and skip Turnstile and validation |
| A custom JWT role through the Data API | Needs the project's JWT signing secret, which can also mint `service_role` tokens: the same blast radius as Option A |
| Supabase Edge Function holding the secret key | Same key, same blast radius, more moving parts |
| A separate Supabase project just for intake | Extra cost and a sync problem for a project this size |

## 5. Recommendation

**Adopt Option B if, and only if, every pass criterion above succeeds on the dev project. Otherwise adopt Option A with the compensating controls and record that decision.** Until the live test, both are plans. The database side is the same either way: `submit_lead` is unchanged, and adding `lead_intake` later is one small additive migration (a copy of the planned file without any password).
