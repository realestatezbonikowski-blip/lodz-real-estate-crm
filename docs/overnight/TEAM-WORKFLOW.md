# CRM team workflow: audit, what was built, what you must configure

When this report was written nothing had been committed, pushed, deployed, or applied to a remote database (the migration's later status is in section 3). The task text you sent was cut off in the middle of
Phase 6 ("Check existing MFA"); phases 1 to 5 were done in full, and Phase 6 was covered by reviewing the existing schema, RLS and
MFA code (below).

## 1. Audit (before changes) and what was done

| Feature | Existing implementation | Missing / incomplete | Action taken |
|---|---|---|---|
| Owner login + authorization | `requireStaff` / `requireOwner`, profiles table, RLS (`is_active_staff`, `is_owner`) | none | unchanged |
| MFA | enforced for enrolled users (previous task); `MFA_MODE` | none | unchanged; new team pages use the same guards |
| Dashboard / lead overview | KPI cards, status tabs, list | no "first steps", no per-person views | first-steps panel, quick views |
| Public leads | `submit_lead`, intake role, visible in the list | none | unchanged |
| Manual lead | `/admin/leads/new`, `createManualLead` | none | unchanged |
| Lead details, contacts | detail page, edit form | responsible person / next contact not summarised | summary line at the top |
| Status + history | `updateLeadStatus`, DB trigger writes `status_change` | none | unchanged |
| Assign to an opiekun | `assignLead` + "Opiekun" select; DB trigger audits `assigned_to` changes | not visible in lists, no "mine/unassigned" views | assignee and "Nieprzypisany" shown on every row; views **Moje leady**, **Nieprzypisane** |
| **Team: add / invite / activate / deactivate** | **none** (only the DB-level policies for the owner) | whole workflow | **`/admin/team`** (owner only), invitation by e-mail, invite state, deactivate / reactivate |
| Notes + contact history | `lead_activities` (note, call, e-mail, meeting), form | latest contact not visible in the list | "last contact" line on each row |
| **Follow-up dates / next action** | **none** (no column) | whole feature | migration + form + "Do kontaktu dziś i zaległe" view (see 3) |
| Search / filters | q, project, source, assignee, archived, status | follow-up filter | added `followup=due` |
| Archive / restore | `setArchived`, buttons | none | unchanged |
| Delete | owner only (action + RLS `leads_delete_owner`) | none | unchanged |
| RBAC / RLS | owner vs assistant; profile writes owner-only; assistant cannot change own role | see access-model note | unchanged |
| Onboarding | none | whole feature | `/admin/help`, first-steps panel |

## 2. What was built
* **Team (`/admin/team`, owner only)**: members, role ("Właściciel" / "Opiekun"), active state, invitation state (needs the server key),
  open-lead count linking to that person's leads, **Dezaktywuj / Aktywuj ponownie** (cannot be applied to yourself; the database also
  refuses to deactivate the last active owner), and **Dodaj opiekuna** (name + e-mail). The role of an invited account is always the
  least-privileged `assistant` (shown as "Opiekun"); the role is not an input.
* **Invitation**: `inviteUserByEmail` through a server-only privileged client (`src/lib/supabase/admin.ts`), after `requireOwner()`. The
  profile row is then created under the owner's own session (RLS `profiles_insert_owner`). If the profile cannot be created, the new
  auth user is deleted again. No key configured = the form is disabled and says so; **nothing is reported as sent unless Supabase accepted it**.
* **Acceptance**: `/admin/auth/confirm` (verifies the one-time token server-side, accepts only `invite` / `recovery`) then `/admin/set-password`
  (min 12 characters). The proxy lets only `/admin/auth/*` through unauthenticated.
* **Assignment views**: Moje leady, Nieprzypisane, Do kontaktu dziś i zaległe; each row shows assignee, follow-up (overdue in red) and the
  latest contact; the lead page shows the responsible person and next contact at the top.
* **Follow-up**: date + next step per lead.
* **Help**: `/admin/help` (short guide using the real tab and button names + a who-can-do-what table) and a first-steps panel for the owner
  with real numbers (is there an opiekun? how many leads are unassigned?).

## 3. Database: ONE new migration (applied to the dev project on 2026-11-01; not applied to any production project)
`supabase/migrations/20261101090000_lead_follow_up.sql`: adds nullable `follow_up_on date` and `next_action text` (length/control-character
checks) to `public.leads`, an index, and `grant update (follow_up_on, next_action)`. No policy, table or status was added or changed.
The local database tests (98) pass with it. **Until you apply it**, the CRM keeps working: lists and details fall back to the old columns and
saving a follow-up shows "dostępne po zastosowaniu migracji". Apply it per `docs/dev-migration-runbook.md` when you are ready.
*Update 2026-11-01:* it has been applied to the dev project with `supabase db push --linked --skip-vault`, after a dry-run that listed only this file. The two columns, the check constraint, the index and the `authenticated` update grant were checked in the database. The text above describes the state before it was applied.

## 4. Access model (a decision for you)
Existing RLS: **every active staff member can read and update every lead** (`leads_select_staff`, `leads_update_staff`); deleting is owner-only;
profiles are writable by the owner only. I did **not** narrow or widen this. Consequences: an opiekun can open and reassign any lead
(the help page says so), and "Moje leady" is a filter, not a restriction. If you want opiekunowie to see only their own leads, that is a new
RLS policy (and a rule for who may reassign) that needs your decision; I will not guess it.

## 5. What you must configure for invitations (otherwise the team page works but cannot invite)
1. Server env `SUPABASE_TEAM_ADMIN_KEY` = a Supabase secret key (server only; never `NEXT_PUBLIC_`). It is a **separate variable on purpose**:
   `SUPABASE_SECRET_KEY` is the optional lead-intake credential and the project rejects setting it together with `LEAD_INTAKE_DATABASE_URL`.
   Consider that this key can administer all Auth users: keep it only on the server host.
2. Supabase -> Authentication -> URL Configuration: add `<NEXT_PUBLIC_SITE_URL>/admin/auth/confirm` to the redirect allow-list.
3. Supabase -> Authentication -> Email Templates -> **Invite user**: set the link to
   `{{ .SiteURL }}/admin/auth/confirm?token_hash={{ .TokenHash }}&type=invite`.
4. Supabase's built-in e-mail sender is rate-limited and meant for testing; configure custom SMTP for real invitations.
5. `NEXT_PUBLIC_SITE_URL` must be the real site URL (used as the redirect base).

## 6. Verified how
Browser suite against a local fake Supabase Auth/REST (never the real project): team list, successful invite, existing address refused,
profile failure rolled back, deactivation, bad/expired token, wrong token type, good token -> set password -> CRM, short password rejected,
unauthenticated access to team and set-password refused, first-steps, quick views, follow-up save, reassign, help page, contrast (0 below AA),
no overflow at 320/390/768/1280, mobile drawer. Unit tests cover the new schemas and the structural security rules. **Not tested**: an
actual e-mail delivery, the real Supabase Admin API, an `assistant` account's view (the fixture signs everyone in as the owner; the
owner-only restriction is covered by `requireOwner()` and the structural tests), and the migration on a live database (since 2026-11-01 it is applied to dev and its columns and grants were checked in the database; the CRM's follow-up save has not been tested against it).
