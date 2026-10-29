-- PLANNED, NOT A MIGRATION. Not applied anywhere. Lives outside supabase/migrations on purpose.
-- Nothing in this file has been tested against Supabase. See docs/lead-intake-credential.md.
--
-- OPTION B for lead intake: instead of the Supabase secret key (which bypasses RLS and can read,
-- change and delete everything), the Next.js server connects to Postgres directly as a role that
-- can do exactly one thing: call public.submit_lead().
--
-- HOW THE ROLE AUTHENTICATES
--   * It does NOT use the Data API / PostgREST and has no API key or JWT. It is an ordinary
--     Postgres LOGIN role with a password, used over a direct SQL connection.
--   * Supabase documents that a custom role can connect through the SHARED POOLER with the
--     username  <role>.<project-ref>  (e.g. lead_intake.<ref>), host copied from the dashboard's
--     Connect dialog (it contains an index and region and must not be guessed), port 6543
--     (transaction mode, recommended for serverless) or 5432 (session mode). The pooler is IPv4.
--     The direct host (db.<ref>.supabase.co) is IPv6-only on Free/Pro without an add-on and is
--     not suitable for most serverless hosts.
--   * Transaction mode does not support prepared statements: the driver must disable them
--     (for postgres.js: prepare: false). TLS: sslmode=require at minimum; verify-full with
--     Supabase's root certificate is better.
--   * The single secret is the role's password, held only in the hosting provider's secret store
--     as a server-only connection string (never NEXT_PUBLIC_, never in git).
--
-- UNVERIFIED (must be proven on the development project before adoption):
--   * that lead_intake.<ref> logs in through the shared pooler (community reports of failures such
--     as "Tenant or user not found" exist and have no confirmed cause);
--   * behaviour after a password change (rotation) and after idle periods;
--   * that failed logins cannot trigger Supabase's automatic network bans against the server;
--   * the connection limit and statement timeout below under the pooler.
--
-- If any check fails, do NOT silently fall back to the secret key. Follow
-- docs/lead-intake-credential.md (decision record).

create role lead_intake nologin noinherit nobypassrls nosuperuser nocreatedb nocreaterole;

alter role lead_intake connection limit 5;
alter role lead_intake set statement_timeout = '5s';
alter role lead_intake set search_path = '';

grant usage on schema public to lead_intake;

grant execute on function public.submit_lead(
  text, text, text, text, text, text, text, text, text, text, text, text, text
) to lead_intake;

-- Deliberately nothing else: no table privileges, no access to schema private (so no access to
-- private.settings), no execute on record_lead_export, no membership in any other role.
--
-- ENABLING LOGIN is a separate manual step and is never committed:
--   Preferred: in psql, connected as the project owner:   \password lead_intake
--     (psql hashes the password on the client, so the plaintext is not sent in a SQL statement
--      and cannot end up in server logs or dashboard query history.)
--   Then:      alter role lead_intake with login;
-- Avoid typing "alter role ... password '<plaintext>'" into the dashboard SQL editor: the text
-- may be kept in its query history (verify), and the password would need rotating afterwards.
