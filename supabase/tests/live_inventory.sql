-- READ-ONLY inventory to run in the Supabase SQL editor AFTER the dev migration is applied.
-- It changes nothing. Compare each result with the "EXPECT" line and record the outcome in
-- docs/security-review-phase-1b.md (section 5). Run the statements one at a time.

-- 1. EXPECT: postgres owns every table and function below (one owner). Note rolsuper/rolbypassrls.
select rolname, rolsuper, rolbypassrls, rolcanlogin, rolconnlimit
from pg_roles
where rolname in ('postgres', 'authenticator', 'anon', 'authenticated', 'service_role', 'lead_intake')
order by rolname;

-- 2. EXPECT: relrowsecurity = true and relforcerowsecurity = false for every row; owner as above.
select n.nspname, c.relname, pg_get_userbyid(c.relowner) as owner, c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'private') and c.relkind = 'r'
order by 1, 2;

-- 3. EXPECT: every row has definer = true (except set_updated_at), cfg = {search_path=""},
--    and the acl text contains NO empty-grantee entry (an entry starting with "=" means PUBLIC).
--    Only authenticated may appear on is_active_staff, is_owner, record_lead_export.
--    submit_lead: only service_role (and lead_intake if Option B has been added).
select n.nspname, p.proname, pg_get_userbyid(p.proowner) as owner, p.prosecdef as definer,
       p.proconfig as cfg, coalesce(p.proacl::text, '<default: PUBLIC execute>') as acl
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
order by 1, 2;

-- 4. EXPECT: zero rows. (Functions in these schemas that anon or PUBLIC could execute.)
select n.nspname, p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private') and has_function_privilege('anon', p.oid, 'execute');

-- 5. EXPECT: zero rows. (Table privileges held by anon.)
select table_schema, table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'anon' and table_schema in ('public', 'private');

-- 6. EXPECT: authenticated has only: profiles/projects select,insert,delete; leads select,delete;
--    lead_activities select; audit_log select; and NOTHING on private.settings.
--    (Column-level insert/update grants are listed by query 7.)
select table_schema, table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'authenticated' and table_schema in ('public', 'private')
order by 1, 2, 3;

-- 7. EXPECT: update on profiles(full_name, role, is_active); projects(name, city, status, is_active,
--    is_published); leads(first_name, last_name, phone, email, message, project_id, status,
--    assigned_to, archived_at). Insert on leads(first_name, last_name, phone, email, message,
--    project_id, assigned_to, locale, source, created_by); lead_activities(lead_id, type, body,
--    occurred_at, actor_id). Nothing else, and never id/slug/created_at/utm_*/privacy_notice_version.
select table_name, column_name, privilege_type
from information_schema.column_privileges
where grantee = 'authenticated' and table_schema = 'public'
order by 1, 3, 2;

-- 8. EXPECT: no policy lists anon or public in roles; every policy is TO authenticated.
select tablename, policyname, cmd, roles
from pg_policies where schemaname = 'public' order by 1, 3, 2;

-- 9. EXPECT: the FK delete rules documented in docs/database.md
--    (a = no action, r = restrict, c = cascade, n = set null).
select conrelid::regclass as tbl, conname, confdeltype
from pg_constraint where contype = 'f' and connamespace = 'public'::regnamespace
order by 1, 2;

-- 10. Default privileges that Supabase defined for other roles (our migration only touches the
--     migration role's defaults). Review any entry granting to anon/authenticated.
select pg_get_userbyid(defaclrole) as for_role, defaclnamespace::regnamespace as in_schema,
       defaclobjtype as kind, defaclacl::text
from pg_default_acl order by 1, 3;

-- 11. EXPECT: no table of ours listed (the realtime publication must not include leads etc.).
select * from pg_publication_tables where schemaname in ('public', 'private');

-- 12. EXPECT: the two approved defaults (100 and 10) before anyone changes them.
select key, int_value from private.settings order by key;

-- 13. Server version and the extensions installed (compare with what the local tests assumed).
select version();
select extname, extversion from pg_extension order by 1;
