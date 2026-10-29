-- Core schema: enums, tables, constraints, indexes, timestamp triggers.
-- Row Level Security is ENABLED here (deny-all until policies exist) so that no table is
-- ever exposed without it. Policies, grants and security functions are in the next migration.
--
-- DRAFT FOR REVIEW. Not applied to any remote database.

-- ---------------------------------------------------------------------------
-- Schemas
-- ---------------------------------------------------------------------------
-- `private` holds security helper and trigger functions. It is not exposed through the
-- Supabase Data API (only `public` is), so those functions cannot be called as RPC.
create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('owner', 'assistant');

create type public.lead_status as enum (
  'new', 'contacted', 'interested', 'meeting', 'converted', 'not_interested', 'unreachable'
);

create type public.project_status as enum ('planning', 'selling', 'completed');

create type public.activity_type as enum ('note', 'call', 'email', 'meeting', 'status_change');

-- ---------------------------------------------------------------------------
-- Shared trigger: server-side updated_at (never trust client-supplied values)
-- ---------------------------------------------------------------------------
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per staff member. Email stays in auth.users (not duplicated here).
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null check (char_length(btrim(full_name)) between 1 and 120),
  role        public.app_role not null default 'assistant',  -- least privilege by default
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- projects: one row per development. Public page content lives in code, keyed by slug.
--   is_active    = project is in use in the CRM (false = archived)
--   is_published = project may be selected on the public lead form
-- The slug is immutable through the API (see grants): code and links depend on it.
-- ---------------------------------------------------------------------------
create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique
                  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 64),
  name          text not null check (char_length(btrim(name)) between 1 and 120),
  city          text not null default 'Łódź' check (char_length(btrim(city)) between 1 and 120),
  status        public.project_status not null default 'planning',
  is_active     boolean not null default true,
  is_published  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- leads
-- Personal data is limited to what the form collects. No IP address, no user agent.
--
-- Single-line text fields reject control characters: btrim() only strips spaces, so tabs and
-- newlines would otherwise pass. The message may contain line breaks but no other control chars.
-- ---------------------------------------------------------------------------
create table public.leads (
  id                        uuid primary key default gen_random_uuid(),

  first_name                text not null
                              check (first_name = btrim(first_name)
                                     and char_length(first_name) between 1 and 100
                                     and first_name !~ '[\x01-\x1f\x7f]'),
  last_name                 text not null
                              check (last_name = btrim(last_name)
                                     and char_length(last_name) between 1 and 100
                                     and last_name !~ '[\x01-\x1f\x7f]'),
  phone                     text not null
                              check (phone ~ '^\+?[0-9][0-9 ()-]{4,24}$'),
  email                     text not null
                              check (email = lower(email)
                                     and char_length(email) <= 254
                                     and email !~ '[\x01-\x1f\x7f]'
                                     and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  message                   text
                              check (message is null
                                     or (char_length(message) <= 2000
                                         and message !~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]')),

  -- RESTRICT: a project that has leads cannot be deleted; archive it with is_active = false.
  project_id                uuid references public.projects (id) on delete restrict,
  status                    public.lead_status not null default 'new',
  -- If a staff account is removed, the lead stays and becomes unassigned.
  assigned_to               uuid references public.profiles (id) on delete set null,

  -- 'web_form' = created by public.submit_lead(); 'manual' = entered by staff (for example a phone enquiry).
  source                    text not null default 'web_form' check (source in ('web_form', 'manual')),
  created_by                uuid references public.profiles (id) on delete set null,

  -- Attribution captured by the server at submission time (immutable afterwards, web forms only).
  locale                    text not null check (locale in ('pl', 'uk', 'en')),
  utm_source                text check (char_length(utm_source) <= 200 and utm_source !~ '[\x01-\x1f\x7f]'),
  utm_medium                text check (char_length(utm_medium) <= 200 and utm_medium !~ '[\x01-\x1f\x7f]'),
  utm_campaign              text check (char_length(utm_campaign) <= 200 and utm_campaign !~ '[\x01-\x1f\x7f]'),
  landing_path              text check (landing_path like '/%' and char_length(landing_path) <= 300
                                        and landing_path !~ '[\x01-\x1f\x7f]'),
  referrer                  text check (char_length(referrer) <= 500 and referrer !~ '[\x01-\x1f\x7f]'),
  -- Required for web leads. How the notice is given for manual (phone) leads is an open legal
  -- question (docs/gdpr-open-questions.md), so the column stays empty for them until decided.
  privacy_notice_version    text check (char_length(privacy_notice_version) between 1 and 50),

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  -- Lets staff (who cannot delete) hide dead leads; also supports retention workflows later.
  archived_at               timestamptz,

  constraint leads_source_shape check (
    (source = 'web_form' and privacy_notice_version is not null and created_by is null)
    or
    (source = 'manual'
       and utm_source is null and utm_medium is null and utm_campaign is null
       and landing_path is null and referrer is null)
  )
);

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function private.set_updated_at();

create index leads_status_created_idx   on public.leads (status, created_at desc);
create index leads_project_created_idx  on public.leads (project_id, created_at desc);
create index leads_created_idx          on public.leads (created_at desc);
create index leads_assigned_idx         on public.leads (assigned_to) where assigned_to is not null;
-- Serve the duplicate-submission check and exact-match search.
create index leads_email_created_idx    on public.leads (email, created_at desc);
create index leads_phone_created_idx    on public.leads (phone, created_at desc);

-- ---------------------------------------------------------------------------
-- lead_activities: append-only contact history (notes, calls, emails, meetings, status changes)
-- ---------------------------------------------------------------------------
create table public.lead_activities (
  id           uuid primary key default gen_random_uuid(),
  -- CASCADE: deleting a lead (e.g. an erasure request) removes its history too.
  lead_id      uuid not null references public.leads (id) on delete cascade,
  type         public.activity_type not null,
  body         text,
  from_status  public.lead_status,
  to_status    public.lead_status,
  -- When the contact happened (may differ from when it was recorded).
  occurred_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  -- RESTRICT: an author's history must not silently lose its author. A staff member who has
  -- recorded anything is deactivated (is_active = false), not deleted.
  actor_id     uuid references public.profiles (id) on delete restrict,

  -- occurred_at may be backdated (a call made earlier) but not set in the future;
  -- created_at is always the real, server-set recording time.
  constraint lead_activities_occurred_check
    check (occurred_at <= created_at + interval '5 minutes'),
  constraint lead_activities_body_chars
    check (body is null or body !~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]'),
  constraint lead_activities_shape check (
    (type = 'status_change'
       and from_status is not null and to_status is not null
       and from_status <> to_status and body is null)
    or
    (type <> 'status_change'
       and from_status is null and to_status is null
       and body is not null and char_length(btrim(body)) between 1 and 5000)
  )
);

create index lead_activities_lead_idx  on public.lead_activities (lead_id, occurred_at desc);
create index lead_activities_actor_idx on public.lead_activities (actor_id) where actor_id is not null;

-- ---------------------------------------------------------------------------
-- audit_log: append-only record of sensitive actions. Contains NO personal data of leads.
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id           bigint generated always as identity primary key,
  occurred_at  timestamptz not null default now(),
  -- Deliberately NOT a foreign key: deleting a staff account must never rewrite who did what.
  actor_id     uuid,
  -- Lead STATUS changes are not duplicated here: they are recorded, with actor and time, in the
  -- append-only lead_activities history. This log holds the other sensitive actions.
  action       text not null check (action in (
                 'lead.delete', 'lead.export', 'lead.update_contact', 'lead.assign',
                 'project.create', 'project.update', 'project.delete',
                 'staff.create', 'staff.update', 'staff.delete',
                 'settings.update')),
  entity_type  text not null check (entity_type in ('lead', 'lead_export', 'project', 'profile', 'setting')),
  entity_id    uuid,
  -- Small structured facts only (changed field NAMES, role changes, export row count, setting
  -- values, staff ids). Never names, emails, phones or message text.
  details      jsonb not null default '{}'::jsonb
                 check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 1024)
);

create index audit_log_occurred_idx on public.audit_log (occurred_at desc);
create index audit_log_entity_idx   on public.audit_log (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- private.settings: the ONE place for operational limits (so the numbers are never duplicated
-- in functions, the app and the tests). Lives in the unexposed `private` schema: no API role can
-- read or write it. Changes are made deliberately by the project owner in the SQL editor or in a
-- migration, and every change is audited (settings.update). The CHECK keeps values inside safe
-- bounds, so a typo cannot silently disable a limit.
-- ---------------------------------------------------------------------------
create table private.settings (
  key         text primary key,
  int_value   integer not null,
  updated_at  timestamptz not null default now(),
  constraint settings_known_keys_and_bounds check (
    (key = 'intake.max_web_leads_per_hour' and int_value between 1 and 1000)
    or
    (key = 'intake.duplicate_window_minutes' and int_value between 1 and 1440)
  )
);

create trigger settings_set_updated_at
  before update on private.settings
  for each row execute function private.set_updated_at();

insert into private.settings (key, int_value) values
  ('intake.max_web_leads_per_hour', 100),   -- circuit breaker for web leads
  ('intake.duplicate_window_minutes', 10);  -- same email/phone within this window is not stored again

-- ---------------------------------------------------------------------------
-- Row Level Security: enabled everywhere. With no policies, access is denied.
-- (FORCE is intentionally NOT used: SECURITY DEFINER functions owned by the migration
--  role must be able to read profiles without triggering policy recursion.)
-- ---------------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.projects        enable row level security;
alter table public.leads           enable row level security;
alter table public.lead_activities enable row level security;
alter table public.audit_log       enable row level security;
alter table private.settings       enable row level security;  -- no policies: API roles get nothing
