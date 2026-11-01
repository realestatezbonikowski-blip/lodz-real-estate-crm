-- Follow-up planning for leads: WHEN to contact the buyer next and WHAT to do.
--
-- NOT APPLIED to any remote database by the author of this file. Apply it deliberately (see
-- docs/dev-migration-runbook.md) BEFORE deploying the CRM version that reads these columns. The CRM
-- degrades gracefully (follow-up fields are simply hidden) while the columns do not exist.
--
-- No new table, no new status: two nullable columns on public.leads, writable by active staff through
-- the existing leads_update_staff policy (a column GRANT is the only extra permission needed).
alter table public.leads
  add column follow_up_on date,
  add column next_action  text
    check (next_action is null
           or (char_length(next_action) between 1 and 200
               and next_action = btrim(next_action)
               and next_action !~ '[\x01-\x1f\x7f]'));

-- "Leads due for contact" view: only leads that actually have a date.
create index leads_follow_up_idx on public.leads (follow_up_on) where follow_up_on is not null;

grant update (follow_up_on, next_action) on public.leads to authenticated;
