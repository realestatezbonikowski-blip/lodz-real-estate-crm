# GDPR / legal: decisions requiring the data controller or legal adviser

Nothing here is decided. No retention period, legal basis or policy wording may be invented by developers.

| # | Question | Who confirms | Code that depends on it |
|---|---|---|---|
| 1 | Who is the data controller (legal entity, contact, DPO if any)? | Company | Privacy page, footer |
| 2 | Legal basis for processing enquiry data (consent vs. pre-contract steps vs. legitimate interest) | Legal adviser | Whether the form has a consent checkbox (config switch, off by default) |
| 3 | Retention period for leads, by status (e.g. converted / not interested / unreachable) | Controller | Deletion procedure and any scheduled job |
| 4 | Privacy notice text in PL / UK / EN | Legal adviser | `/privacy` page, `privacy_notice_version` stored on each lead |
| 5 | Marketing communications: any separate consent? | Legal adviser | Not collected unless confirmed |
| 6 | Processor agreements and transfer assessment: Supabase, hosting, email/Telegram, Cloudflare Turnstile | Controller / adviser | Provider choices |
| 7 | Procedure for access, rectification and erasure requests | Controller | Owner-only delete + audit log |
| 8 | Cookies / analytics: used at all? | Company / adviser | Cookie banner decision |
| 9 | Backup retention vs. erasure obligations | Adviser | Backup configuration |

## Questions raised by the database design (Phase 1A)

Still undecided. The schema currently stores the data listed, and nothing more.

| # | Question | Who confirms | Schema impact |
|---|---|---|---|
| 10 | Is storing `utm_source/medium/campaign`, `landing_path` and `referrer` justified, and must it be mentioned in the notice? | Legal adviser | Columns on `leads`. Referrer should be stored without its query string |
| 11 | Is a consent timestamp needed (depends on #2)? | Legal adviser | A nullable `consent_at` column would be added in a later migration |
| 12 | Do free-text notes in `lead_activities` and the `message` field fall under the same retention period as the lead? | Controller | Deletion procedure |
| 13 | May staff-written notes contain special-category data, and what guidance do staff get? | Controller / adviser | Staff guidance, not schema |
| 14 | Is the audit log (staff ids, lead ids, no names) personal data, and how long is it kept? | Adviser | Audit retention |
| 15 | Should the access of assistants to all leads be limited by project or assignment? | Owner / adviser | RLS would change from "all leads" to "assigned leads" |
| 16 | Which processors see lead data: Supabase (region West EU / Ireland), hosting, notification channel | Controller / adviser | Same as #6 |

## Questions raised by the Phase 1B review

| # | Question | Who confirms | Schema / code impact |
|---|---|---|---|
| 17 | Leads entered by phone (`source = 'manual'`): how and when is the privacy notice given to the person, and is it recorded? | Controller / adviser | `privacy_notice_version` is empty for manual leads; a column or procedure may be needed |
| 18 | Is the circuit breaker's silent refusal of leads (`rate_limited`) acceptable, and what alert must the owner receive? | Owner | Notification and monitoring design |
| 19 | Which of the Supabase secret key (Option A) or a dedicated database role (Option B) is acceptable as the server credential for personal data? | Controller (technical measures) | See `docs/security-review-phase-1b.md` |
| 20 | Contact-detail and assignment changes are now audited (field names and staff ids only). Is that sufficient as a rectification trail, and how long is the audit log kept? | Controller / adviser | Audit retention; wider coverage if required |

## Questions raised by Phase 2 (public form)

| # | Question | Who confirms | Code that depends on it |
|---|---|---|---|
| 21 | The enquiry endpoint uses the client's network address transiently in server memory for rate limiting (not stored, not logged, not sent to Turnstile). Is that acceptable, and must the notice mention it? Turnstile itself also processes visitor data in the browser (provider assessment is item 6) | Legal adviser | `src/app/api/leads/route.ts`, `src/lib/security/rate-limit.ts` |
| 22 | What value should `leads.privacy_notice_version` hold, and where is the notice shown on the form? Today: placeholder `placeholder-0` and a marked placeholder paragraph | Legal adviser | `src/features/leads/config.ts`, `LeadForm` |

## Launch gate
The public site must not go live with placeholder legal text. Items 1, 2, 4 and 6 are required before launch.
