# Overnight mission: baseline (Phase A)

Recorded before any change in this mission.

| Item | State |
|---|---|
| Branch / HEAD | `main` / `588cdfd` (public redesign, local only) |
| Git remotes | **none configured** (so nothing can be pushed) |
| Uncommitted work | 35 paths: security / MFA / login guard / Supabase cookie policy / CRM work from earlier sessions, `docs/`, `.claude/`, `consept/`. Preserved untouched. |
| Node | v24.20.0 (`engines`: >=20.9) |
| Tests at start | unit 197/197, database 98/98, lint, typecheck, build: all passing |

## MFA diagnosis (confirmed from code, not guessed)
* `src/features/mfa/policy.ts` already contained the decision logic (`parseMode`, `decideMfaAccess`) and its header said it was
  "NOT wired into requireStaff()/requireOwner()". `MFA_MODE` was read nowhere.
* `requireStaff()` (`src/features/crm/auth.ts`), which gates every CRM page and server action, only checked
  "valid session + active profile". An aal1 (password-only) session therefore reached the CRM even for a user with a
  verified TOTP factor. `src/features/mfa/guards.test.ts` even asserted "ENFORCEMENT IS NOT ENABLED YET".
* So the cause is (3)+(4) of the brief: enforcement was never wired, not a Supabase misconfiguration. See `MFA.md`.

## Biggest problems found
* CRM: light "paper" theme, plain button tabs, no responsive navigation (header wrapped on phones), list rows not designed for touch.
* Public: no regressions found at baseline; mobile pass later found and fixed one overflow regression I introduced (see FINAL-REPORT).
