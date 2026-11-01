# CRM Overrides

> **PROJECT:** RealEstateCRM | **Page type:** internal CRM (`/admin/*`, Polish only)
>
> Rules here **override** `design-system/realestatecrm/MASTER.md`. Only deviations are listed.

**Dials:** Variance 3 | Motion 2 (subtle) | Density 8 (dense, information-first)

---

## Principles

Utilitarian and calm: the CRM is a daily tool, not a showcase. Same palette and hairline language as the public site, different type and density.

## Typography overrides

- **Inter only.** No display serif in the CRM, except the wordmark on the login screen. This also removes the display font download from every CRM page.
- Tabular numerals (`font-variant-numeric: tabular-nums`) for phone numbers, dates, counts and any column of numbers.
- Page titles 24-32px Inter 600; table text 14-15px; no text under 13px.

## Layout and navigation

- **>= 1024px:** left sidebar (icon + label, current page marked with more than colour) and a slim top bar with search and the user menu.
- **< 1024px:** compact top bar with a drawer; the bar never wraps onto two rows at 320px.
- Navigation placement is identical on every CRM page. Destructive/account actions (sign out) are visually separate from navigation.
- Pages: Leady, Nowy lead, Bezpieczeństwo; later Projekty and Zespół (not built).

## Density

- Comfortable (default) and Compact row modes (a per-user presentation preference only). Rows at least 44px on touch, 36px compact on pointer devices.
- Touch targets 44px; no control below 24px.

## Leads list

- Table with **sticky column headers**, sortable (`aria-sort`) by date, status and name; keyboard operable.
- Status filter as a **single horizontally scrolling row** of chips with counts (not four wrapped rows).
- Filters in a collapsible panel on mobile: "Filtry (n)" with the active count; results visible without scrolling past a full screen of controls.
- Each row: name, project, phone and e-mail as `tel:`/`mailto:` quick actions, status, assignee (initials plus name), **relative time** with the absolute time in a `title`/tooltip.
- A "new today / this week" strip computed from existing `created_at` values (no schema change).
- Counts in Polish use correct plural forms (1 lead, 2-4 leady, 5+ leadów, 12-14 leadów, 22-24 leady).
- Empty states say what to do next; loading uses skeletons that keep the layout; errors are never shown as "no results".

## Status colours

Semantic tokens from the Master (success/warning/danger/info plus neutral), always **icon + label**, never the brand accent:

| Status | Treatment |
|---|---|
| Nowy | info tint |
| Po kontakcie | neutral tint |
| Zainteresowany | warning tint |
| Spotkanie | info solid |
| Zrealizowany | success tint |
| Niezainteresowany / Nieosiągalny | neutral, muted, with distinct icons |

## Forms and actions

- Same field, label, error-summary and helper-text spec as the Master; placeholder colour is `--muted` (fixes 3.4:1).
- Checkboxes at least 24x24 hit area.
- Destructive actions: confirmation plus semantic danger colour, separated from primary actions; **archive offers an undo toast**; delete keeps its confirmation.
- Toasts do not steal focus and use `aria-live="polite"`.

## Do not change here

Authentication, authorisation, MFA, rate limiting, RLS and business logic are out of scope for any visual work. Visual changes must not alter what a server action validates or writes.

## Responsive checks

320, 360, 375, 390, 768, 1024, 1440. The list, detail and security screens must have no horizontal scroll and no wrapped navigation.
