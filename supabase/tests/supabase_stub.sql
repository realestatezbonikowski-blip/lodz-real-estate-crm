-- Minimal imitation of the Supabase pieces our migrations depend on, for LOCAL testing only.
-- This is NOT Supabase. It must never be applied to a real project.

create role anon          nologin noinherit;
create role authenticated nologin noinherit;
create role service_role  nologin noinherit bypassrls;

create schema auth;
create table auth.users (id uuid primary key, email text);

-- Same logic as Supabase's auth.uid(): read the user id from the request JWT claims.
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

-- Same idea as Supabase's auth.jwt(): the whole claims object (used by the planned MFA check).
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;

-- Supabase's permissive defaults on the public schema: every new table/function/sequence is
-- granted to the API roles. The migrations must tighten this; the tests prove they do.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
