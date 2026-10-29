-- PLANNED, NOT A MIGRATION. Not applied anywhere. Lives outside supabase/migrations on purpose.
--
-- Makes the database itself require a second factor from staff. Every policy in the security
-- migration goes through the two helper functions below, so enforcing MFA is a one-file change:
-- redefine them to also require the session's authentication assurance level to be `aal2`.
-- (Supabase puts an `aal` claim in the JWT: `aal1` = password only, `aal2` = password + TOTP.
--  Confirm the claim on the real project before applying, see docs/database.md.)
--
-- WHEN to apply: only after the CRM has a working MFA enrolment and challenge screen (Phase 4),
-- and after every staff member has enrolled a factor. Otherwise staff are locked out.
--
-- UI consequence: at aal1 the database returns nothing, not even the user's own profile. The
-- login flow must use the Auth API only (enrol, challenge, verify) until the session is aal2,
-- and must not depend on reading `profiles` at aal1.
--
-- CREATE OR REPLACE keeps the existing EXECUTE grants. service_role is unaffected (bypasses RLS).

create or replace function private.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active
  )
  and coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2';
$$;

create or replace function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active and p.role = 'owner'
  )
  and coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2';
$$;
