-- Option B for lead intake: a dedicated Postgres role that can do exactly one thing, call
-- public.submit_lead(). The Next.js server connects as this role over the Supabase shared pooler
-- (LEAD_INTAKE_DATABASE_URL) instead of holding the Supabase secret key, which bypasses RLS and
-- can read, change and delete everything. See docs/lead-intake-credential.md.
--
-- DRAFT FOR REVIEW. Not applied to any remote database. Applying it creates a cluster-level role
-- on the project; it needs the owner's explicit approval.
--
-- THIS MIGRATION CONTAINS NO PASSWORD AND CANNOT LOG IN.
--   The role is created NOLOGIN. Enabling login and setting its password is a separate manual step
--   that is never committed:
--     1. In psql, connected as the project owner:   \password lead_intake
--        (psql hashes the password on the client, so the plaintext is not sent in a SQL statement
--         and cannot end up in server logs or the dashboard's query history.)
--     2. Then:  alter role lead_intake with login;
--   Avoid typing "alter role ... password '<plaintext>'" into the dashboard SQL editor: the text
--   may be kept in its query history, and the password would then need rotating.
--
-- HOW THE ROLE CONNECTS (from Supabase's connection documentation; UNVERIFIED on this project)
--   * No Data API, API key or JWT: an ordinary LOGIN role with a password over a direct SQL
--     connection.
--   * Shared pooler, username  lead_intake.<project-ref>, transaction mode (port 6543), TLS on,
--     prepared statements off in the driver. The direct host is IPv6-only on Free/Pro.
--   * Community reports of custom roles failing through the pooler exist ("Tenant or user not
--     found"). Do not adopt this until every pass criterion in the decision record has been met
--     on the development project. If any fails, do NOT silently fall back to the secret key.
--
-- LEAST PRIVILEGE: with "Automatically expose new tables" off, nothing is granted by default, so
-- every privilege below is explicit. It gets USAGE on schema public (to resolve the function name)
-- and EXECUTE on submit_lead, nothing else: no table privileges, no access to schema private (so
-- none to private.settings), no EXECUTE on record_lead_export, no membership in any other role,
-- no BYPASSRLS. submit_lead is SECURITY DEFINER and does the real work as its owner.

create role lead_intake nologin noinherit nobypassrls nosuperuser nocreatedb nocreaterole;

alter role lead_intake connection limit 5;
alter role lead_intake set statement_timeout = '5s';
alter role lead_intake set search_path = '';

grant usage on schema public to lead_intake;

grant execute on function public.submit_lead(
  text, text, text, text, text, text, text, text, text, text, text, text, text
) to lead_intake;
