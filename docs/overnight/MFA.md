# Two-factor authentication: root cause, fix, decision

## Root cause
The MFA screens (`/admin/security`, `/admin/mfa`) and the policy functions existed, but **nothing applied them to CRM access**.
`requireStaff()` accepted any valid session, so a password-only (aal1) session opened the CRM even when the account had a
verified authenticator app.

## Fix (application level, no schema or RLS change)
`src/features/crm/auth.ts` `requireStaff()` now, after validating the user with `getUser()`:
1. loads the MFA state from server-validated sources (`loadMfaState`, which verifies the token signature via `getClaims()`),
2. calls `decideMfaAccess({ mode, currentLevel, nextLevel, hasVerifiedFactor })`,
3. redirects: `challenge` -> `/admin/mfa`, `enrol` -> `/admin/security`, `deny` -> `/admin/login`.

Because every CRM page and server action already calls `requireStaff()`, none of them returns data before the check passes.
The MFA screens use `requireMfaSession()` (no profile/table read), so there is no redirect loop and a user can always
reach the challenge or enrol.

## Policy decision (made from the existing design, not invented)
`MFA_MODE` = `off` | `enrolled` | `required`.
* **unset (default) = `enrolled`**: anyone who HAS a verified factor must complete it (aal2); accounts without a factor are
  NOT forced to enrol (this matches the brief: no unapproved organisation-wide policy).
* `required`: every account must enrol and verify. **Needs the owner's decision**; set `MFA_MODE=required` on the host when approved.
* `off`: disables enforcement (kept only as an explicit, visible setting).
* any other value fails closed to `required`.

`src/features/mfa/policy.test.ts` is unchanged (it still pins `parseMode("")` = `off`); the default `enrolled` is applied in `auth.ts`.
`guards.test.ts` previously asserted "enforcement is not enabled yet"; that assertion described the superseded state and was
replaced by tests that the gate exists, uses validated state, defaults to `enrolled`, and that the MFA screens never use `requireStaff`.

## Verified in a browser (against a local fake Supabase Auth, never the real project)
enrol a factor -> new password sign-in (aal1) -> `/admin/leads`, `/admin/leads/new`, `/admin/leads/[id]`, `/admin` all redirect to
`/admin/mfa`; no lead data rendered; wrong code stays on the challenge with an error; correct code opens the CRM; account
without a factor still signs in. This is fixture-level evidence, not a test against the live Supabase project.

## Not done (needs you)
* Database-level enforcement (`supabase/planned/mfa_enforcement.sql`) is still NOT applied (separate, approved step).
* Choose `required` vs `enrolled` for the assistant account.
* Supabase dashboard: TOTP must be enabled (already confirmed earlier in this project); on the deployed domain add the site URL to
  Auth -> URL Configuration.
