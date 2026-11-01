# Public Site Overrides

> **PROJECT:** RealEstateCRM | **Page type:** public marketing site (`/pl`, `/uk`, `/en`)
>
> Rules here **override** `design-system/realestatecrm/MASTER.md`. Only deviations are listed.
> (The skill generated this file with the wrong page type, "Dashboard / Data View"; it was rewritten by hand.)

**Dials:** Variance 5 | Motion 3 | Density 3 (spacious, editorial)

---

## Layout

- Container max 72rem, 12-column grid, generous vertical rhythm (sections 64-128px).
- Hairline rules and numbered section labels (`01`, `02`) as the architectural motif; thin dimension-line details. **No depiction of a building, floors, windows or proportions** until approved visualisations exist.
- Imagery-led once real assets arrive; until then the labelled abstract placeholder system is used.

## Typography overrides

- Display: Cormorant Garamond 500, **32px and above only**, in headlines and the wordmark slot. Fluid: `clamp(2.75rem, 8.5vw, 7rem)` for the hero.
- Everything below display size is Inter. Eyebrows/tags **13px**.
- The brand placeholder (`[Nazwa dewelopera]`) must never be wider than the header allows (see below).

## Header and navigation (fixes the verified overflow)

- The header must fit at **320px in all three locales** with no horizontal scroll: brand may truncate with an accessible full name, or the language switcher moves into the menu below 400px; never rely on `whitespace-nowrap` for a placeholder name.
- Items: brand, primary links (project, units when data exists, location, contact), language switcher (always reachable), and one primary contact call-to-action.
- Mobile: persistent contact action allowed, but it must never cover a focused control.
- Unknown URLs under a locale render a **localised, styled 404** with the header and a way home.

## Home structure (content-bound, no invented claims)

1. Hero: headline, project teaser, one primary action.
2. Project strip: facts from `src/features/projects/data.ts`; unconfirmed values read "to be confirmed".
3. Location: Łódź context. No address, distances or amenities until supplied.
4. Units explorer: appears only when verified unit data exists; otherwise a labelled "coming" state.
5. Visualisations and plans: every item labelled Wizualizacja / Szkic / Rzut / Zdjęcie.
6. Developer: placeholder until approved copy.
7. Contact with the enquiry form.

## International buyers

- Phone field with country prefix guidance and an international-format example; accepts `+` and spaces.
- Optional "contact me in" language preference (the lead already stores the interface locale).
- Locale-aware numbers, m² and PLN. No translated legal text is presented as approved.

## Forms

- Visible labels, helper text, inline errors, **focusable error summary after failed submit**, success state that states what happens next only with approved wording.
- Turnstile placement must not shift layout; reserve its height.
- Consent/privacy block remains a marked placeholder until approved text exists.

## Launch-time SEO (currently noindex)

`<link rel="alternate" hreflang>` in the HTML (today only an HTTP header), canonical URLs, Open Graph/Twitter tags, sitemap, structured data **only for facts that are verified**.

## Imagery rules

Renderings, sketches, plans and photographs are visually and textually distinct; alt text per locale; explicit width/height; lazy-load below the fold; WebP/AVIF.
