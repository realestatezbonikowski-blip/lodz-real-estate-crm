-- The ONLY way a lead is created: public.submit_lead().
--
-- It is executable by `service_role` alone (plus, if Option B is verified and adopted, the
-- dedicated `lead_intake` role added by a later migration). The Next.js server endpoint (not
-- built yet) will: verify Turnstile -> validate with Zod -> call this function with a
-- server-only credential. Browsers, `anon` and `authenticated` users cannot execute it, so the
-- form protections (Turnstile, validation) cannot be bypassed through the database API.
--
-- Operational limits are NOT written here. They are read from private.settings:
--   intake.max_web_leads_per_hour    (circuit breaker)
--   intake.duplicate_window_minutes  (same email/phone is not stored again within this window)
-- If a setting is missing the function fails closed (raises) instead of running without a limit.
--
-- DRAFT FOR REVIEW. Not applied to any remote database.

create function public.submit_lead(
  p_first_name              text,
  p_last_name               text,
  p_phone                   text,
  p_email                   text,
  p_project_slug            text,   -- null = general enquiry
  p_message                 text,
  p_locale                  text,
  p_utm_source              text,
  p_utm_medium              text,
  p_utm_campaign            text,
  p_landing_path            text,
  p_referrer                text,
  p_privacy_notice_version  text
)
returns text   -- 'created' | 'duplicate' | 'rate_limited'
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_email      text := lower(btrim(p_email));
  v_phone      text := btrim(p_phone);
  v_max_hour   integer;
  v_dup_mins   integer;
begin
  select s.int_value into v_max_hour from private.settings s where s.key = 'intake.max_web_leads_per_hour';
  select s.int_value into v_dup_mins from private.settings s where s.key = 'intake.duplicate_window_minutes';
  if v_max_hour is null or v_dup_mins is null then
    raise exception 'intake settings missing' using errcode = '55000';
  end if;

  if p_project_slug is not null then
    select p.id into v_project_id
    from public.projects p
    where p.slug = p_project_slug and p.is_active and p.is_published;

    if v_project_id is null then
      raise exception 'invalid_project' using errcode = '22023';
    end if;
  end if;

  -- Throttle double-submits: same email or phone within the configured window is not stored again.
  -- (A throttle, not full de-duplication. The caller shows the same success message either way.)
  if exists (
    select 1 from public.leads l
    where (l.email = v_email or l.phone = v_phone)
      and l.created_at > now() - make_interval(mins => v_dup_mins)
  ) then
    return 'duplicate';
  end if;

  -- Global circuit breaker. Turnstile and the per-email/phone throttle do not bound the total:
  -- someone solving challenges (or farming them) with varying emails could still flood the table
  -- and the free-tier storage. Past this many web leads in an hour we stop storing and signal the
  -- caller. The caller must show a generic "try again later" (not success) and alert the owner.
  -- The default (100/hour) is far above real demand for a 15-20 apartment project.
  if (
    select count(*) from public.leads l
    where l.source = 'web_form' and l.created_at > now() - interval '1 hour'
  ) >= v_max_hour then
    return 'rate_limited';
  end if;

  -- Table CHECK constraints are the last line of defence if the caller skipped validation.
  insert into public.leads (
    first_name, last_name, phone, email, message, project_id, locale,
    utm_source, utm_medium, utm_campaign, landing_path, referrer, privacy_notice_version
  ) values (
    btrim(p_first_name), btrim(p_last_name), v_phone, v_email,
    nullif(btrim(p_message), ''), v_project_id, p_locale,
    nullif(btrim(p_utm_source), ''), nullif(btrim(p_utm_medium), ''), nullif(btrim(p_utm_campaign), ''),
    nullif(btrim(p_landing_path), ''), nullif(btrim(p_referrer), ''), p_privacy_notice_version
  );

  return 'created';
end;
$$;

revoke execute on function public.submit_lead(
  text, text, text, text, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.submit_lead(
  text, text, text, text, text, text, text, text, text, text, text, text, text
) to service_role;
