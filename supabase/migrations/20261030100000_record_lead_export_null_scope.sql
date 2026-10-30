-- Fix: public.record_lead_export() accepted a NULL p_scope.
--
-- The argument check was `p_row_count is null or p_row_count < 0 or p_scope not in (...)`.
-- With a valid row count and p_scope = NULL, `p_scope not in (...)` is NULL, the whole condition
-- is NULL, and an IF treats NULL as false, so no exception was raised and an audit row with
-- "scope": null was written. Only the owner can reach the write, so the impact is an imprecise
-- audit row, not a data exposure.
--
-- CREATE OR REPLACE keeps the function's owner and its existing EXECUTE privileges (authenticated,
-- service_role, owner; not PUBLIC or anon), so no grant or revoke is repeated here. The body is
-- otherwise identical to 20261029120100_security_policies.sql, section 6.

create or replace function public.record_lead_export(p_row_count integer, p_scope text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_row_count is null or p_row_count < 0
     or p_scope is null or p_scope not in ('all', 'filtered') then
    raise exception 'invalid arguments' using errcode = '22023';
  end if;
  perform private.write_audit(
    'lead.export', 'lead_export', null,
    jsonb_build_object('rows', p_row_count, 'scope', p_scope)
  );
end;
$$;
