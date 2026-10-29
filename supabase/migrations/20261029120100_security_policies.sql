-- Authorization: helper functions, triggers, RLS policies and grants.
-- Model: deny by default. Only authenticated, ACTIVE staff get access; the owner gets more.
--
-- DRAFT FOR REVIEW. Not applied to any remote database.

-- ---------------------------------------------------------------------------
-- 1. Remove Supabase's permissive default grants, then grant only what is needed.
--    (Supabase grants ALL on new public objects to anon/authenticated by default.)
-- ---------------------------------------------------------------------------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- FUNCTIONS: PostgreSQL grants EXECUTE to PUBLIC on every new function, and the statements
-- above cannot remove that. RULE: every function created in `public` must carry its own explicit
-- `revoke execute ... from public, anon, authenticated` (all current ones do, and the test suite
-- fails if any function in public/private is executable by anon).
-- A global `alter default privileges revoke execute on functions from public` is deliberately
-- NOT used: it applies to every schema, including extension installs, and could break them.

-- ---------------------------------------------------------------------------
-- 2. Helper functions (schema `private`, not exposed as RPC).
--    SECURITY DEFINER so they can read `profiles` without invoking profiles' own RLS
--    (which would recurse). They pin search_path and never read user-editable JWT metadata.
-- ---------------------------------------------------------------------------
create function private.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active
  );
$$;

create function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active and p.role = 'owner'
  );
$$;

-- Records the audit row. Callable only by other definer functions/triggers (no grants).
create function private.write_audit(
  p_action text, p_entity_type text, p_entity_id uuid, p_details jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (
    -- null-safe: the actor may be the service/SQL editor (no profile) or just deleted
    (select p.id from public.profiles p where p.id = (select auth.uid())),
    p_action, p_entity_type, p_entity_id, p_details
  );
$$;

-- (Execute privileges for the private functions are set at the end of this file.)
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Triggers
-- ---------------------------------------------------------------------------

-- 3a. Every status change on a lead writes a tamper-proof activity row. Staff cannot insert
--     'status_change' activities themselves (policy + column grants), so the history is reliable.
create function private.log_lead_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.lead_activities (lead_id, type, from_status, to_status, actor_id)
  values (
    new.id, 'status_change', old.status, new.status,
    (select p.id from public.profiles p where p.id = (select auth.uid()))
  );
  return new;
end;
$$;

create trigger leads_log_status_change
  after update of status on public.leads
  for each row
  when (old.status is distinct from new.status)
  execute function private.log_lead_status_change();

-- 3b. Audit: lead deletion (id only, no personal data).
create function private.audit_lead_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.write_audit('lead.delete', 'lead', old.id);
  return old;
end;
$$;

create trigger leads_audit_delete
  after delete on public.leads
  for each row execute function private.audit_lead_delete();

-- 3b-2. Audit: changes to a lead's contact details and assignment.
--       Records WHICH fields changed (names only) and the staff ids for assignment; never the
--       old or new personal values. Status changes are in lead_activities (see 3a).
create function private.audit_lead_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fields text[];
begin
  v_fields := array_remove(array[
    case when new.first_name is distinct from old.first_name then 'first_name' end,
    case when new.last_name  is distinct from old.last_name  then 'last_name'  end,
    case when new.phone      is distinct from old.phone      then 'phone'      end,
    case when new.email      is distinct from old.email      then 'email'      end
  ], null);

  if cardinality(v_fields) > 0 then
    perform private.write_audit('lead.update_contact', 'lead', new.id,
      jsonb_build_object('fields', to_jsonb(v_fields)));
  end if;

  if new.assigned_to is distinct from old.assigned_to then
    perform private.write_audit('lead.assign', 'lead', new.id,
      jsonb_build_object('from', old.assigned_to, 'to', new.assigned_to));
  end if;

  return null;
end;
$$;

create trigger leads_audit_change
  after update of first_name, last_name, phone, email, assigned_to on public.leads
  for each row
  when (
    old.first_name  is distinct from new.first_name
    or old.last_name  is distinct from new.last_name
    or old.phone      is distinct from new.phone
    or old.email      is distinct from new.email
    or old.assigned_to is distinct from new.assigned_to
  )
  execute function private.audit_lead_change();

-- 3b-3. Audit: changes to operational settings (key and values only).
create function private.audit_settings_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.write_audit('settings.update', 'setting', null,
    jsonb_build_object('key', new.key, 'from', old.int_value, 'to', new.int_value));
  return null;
end;
$$;

create trigger settings_audit_update
  after update on private.settings
  for each row
  when (old.int_value is distinct from new.int_value)
  execute function private.audit_settings_change();

-- 3c. Audit: project changes.
create function private.audit_project_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.write_audit('project.create', 'project', new.id);
  elsif tg_op = 'UPDATE' then
    perform private.write_audit('project.update', 'project', new.id);
  else
    perform private.write_audit('project.delete', 'project', old.id);
  end if;
  return null;
end;
$$;

create trigger projects_audit
  after insert or update or delete on public.projects
  for each row execute function private.audit_project_change();

-- 3d. Audit: staff changes (role and active flag only).
create function private.audit_profile_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.write_audit('staff.create', 'profile', new.id, jsonb_build_object('role', new.role));
  elsif tg_op = 'UPDATE' then
    perform private.write_audit('staff.update', 'profile', new.id, jsonb_build_object(
      'from_role', old.role, 'to_role', new.role,
      'from_active', old.is_active, 'to_active', new.is_active));
  else
    perform private.write_audit('staff.delete', 'profile', old.id);
  end if;
  return null;
end;
$$;

create trigger profiles_audit_insert
  after insert on public.profiles
  for each row execute function private.audit_profile_change();

create trigger profiles_audit_update
  after update on public.profiles
  for each row
  when (old.role is distinct from new.role or old.is_active is distinct from new.is_active)
  execute function private.audit_profile_change();

create trigger profiles_audit_delete
  after delete on public.profiles
  for each row execute function private.audit_profile_change();

-- 3e. Lock-out protection: the last active owner cannot be demoted, deactivated or deleted.
create function private.protect_last_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner' and old.is_active
     and (tg_op = 'DELETE' or new.role <> 'owner' or not new.is_active)
  then
    perform pg_advisory_xact_lock(hashtext('profiles_last_owner_guard'));
    if not exists (
      select 1 from public.profiles p
      where p.role = 'owner' and p.is_active and p.id <> old.id
    ) then
      raise exception 'cannot remove the last active owner' using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger profiles_protect_last_owner
  before update or delete on public.profiles
  for each row execute function private.protect_last_owner();

-- ---------------------------------------------------------------------------
-- 4. RLS policies. All are TO authenticated; anon has no policies and no grants.
--    `(select ...)` wrappers let Postgres evaluate the helper once per statement.
-- ---------------------------------------------------------------------------

-- profiles: active staff can read the (small) staff list; only the owner can change it.
-- Nobody can edit their own role: an assistant has no write policy at all.
create policy profiles_select_staff on public.profiles
  for select to authenticated using ((select private.is_active_staff()));
create policy profiles_insert_owner on public.profiles
  for insert to authenticated with check ((select private.is_owner()));
create policy profiles_update_owner on public.profiles
  for update to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
create policy profiles_delete_owner on public.profiles
  for delete to authenticated using ((select private.is_owner()));

-- projects: staff read; owner manages.
create policy projects_select_staff on public.projects
  for select to authenticated using ((select private.is_active_staff()));
create policy projects_insert_owner on public.projects
  for insert to authenticated with check ((select private.is_owner()));
create policy projects_update_owner on public.projects
  for update to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
create policy projects_delete_owner on public.projects
  for delete to authenticated using ((select private.is_owner()));

-- leads: staff read, update and add MANUAL leads (phone enquiries); only the owner deletes.
-- Web leads are created only by public.submit_lead (see next migration). A staff insert must
-- declare itself manual and be attributed to the caller; column grants below also keep
-- attribution and privacy-notice fields out of reach.
create policy leads_select_staff on public.leads
  for select to authenticated using ((select private.is_active_staff()));
create policy leads_insert_staff_manual on public.leads
  for insert to authenticated
  with check (
    (select private.is_active_staff())
    and source = 'manual'
    and created_by = (select auth.uid())
  );
create policy leads_update_staff on public.leads
  for update to authenticated
  using ((select private.is_active_staff())) with check ((select private.is_active_staff()));
create policy leads_delete_owner on public.leads
  for delete to authenticated using ((select private.is_owner()));

-- lead_activities: staff read; staff add manual entries authored as themselves.
-- No update/delete policy: the history is append-only.
create policy lead_activities_select_staff on public.lead_activities
  for select to authenticated using ((select private.is_active_staff()));
create policy lead_activities_insert_staff on public.lead_activities
  for insert to authenticated
  with check (
    (select private.is_active_staff())
    and type <> 'status_change'
    and actor_id = (select auth.uid())
  );

-- audit_log: the owner can read; nobody can write through the API (triggers/definer functions only).
create policy audit_log_select_owner on public.audit_log
  for select to authenticated using ((select private.is_owner()));

-- ---------------------------------------------------------------------------
-- 5. Table and column grants (second layer, independent of RLS).
-- ---------------------------------------------------------------------------
grant select, insert, delete on public.profiles to authenticated;
grant update (full_name, role, is_active) on public.profiles to authenticated;

grant select, insert, delete on public.projects to authenticated;
-- slug is not updatable: public content and links are keyed by it. Changing one is a deliberate migration.
grant update (name, city, status, is_active, is_published) on public.projects to authenticated;

-- Immutable after creation (not grantable): id, source, created_by, locale, utm_*, landing_path,
-- referrer, privacy_notice_version, created_at, updated_at (maintained by trigger).
grant select, delete on public.leads to authenticated;
-- Staff may insert only these columns (manual leads). Everything else takes its default or stays null.
grant insert (first_name, last_name, phone, email, message, project_id, assigned_to, locale, source, created_by)
  on public.leads to authenticated;
grant update (first_name, last_name, phone, email, message, project_id, status, assigned_to, archived_at)
  on public.leads to authenticated;

-- from_status/to_status can only be written by the status-change trigger.
grant select on public.lead_activities to authenticated;
grant insert (lead_id, type, body, occurred_at, actor_id) on public.lead_activities to authenticated;

grant select on public.audit_log to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Export audit. RLS cannot tell "viewing" from "exporting" (staff legitimately read leads),
--    so the export feature (Phase 5) must authorize the owner in the app AND call this function,
--    which re-checks the owner role inside the database and records the export.
-- ---------------------------------------------------------------------------
create function public.record_lead_export(p_row_count integer, p_scope text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_row_count is null or p_row_count < 0 or p_scope not in ('all', 'filtered') then
    raise exception 'invalid arguments' using errcode = '22023';
  end if;
  perform private.write_audit(
    'lead.export', 'lead_export', null,
    jsonb_build_object('rows', p_row_count, 'scope', p_scope)
  );
end;
$$;

revoke execute on function public.record_lead_export(integer, text) from public, anon;
grant  execute on function public.record_lead_export(integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Execute privileges for private functions (done last so it covers every function above).
--    Trigger functions need no EXECUTE grant to fire. Only the two RLS helpers do.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_active_staff() to authenticated;
grant execute on function private.is_owner()        to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Settings are not reachable through the API at all (the schema is not exposed, and these
--    revokes make that true even if it ever were). public.submit_lead reads them as its owner.
-- ---------------------------------------------------------------------------
revoke all on private.settings from public, anon, authenticated;
