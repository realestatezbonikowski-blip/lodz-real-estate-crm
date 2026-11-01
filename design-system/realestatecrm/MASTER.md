# Design System Master File: Limestone & Ink

> **LOGIC:** When building a specific page, first check `design-system/realestatecrm/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file. Otherwise follow the rules below.
> Pages: `pages/public.md` (marketing site) and `pages/crm.md` (internal CRM).

---

**Project:** RealEstateCRM (provisional; the real brand name is not confirmed)
**Direction:** Limestone & Ink: warm limestone, ink, deep-stone surfaces, one restrained terracotta accent, fine architectural rules, editorial minimalism
**Persisted with:** `ui-ux-pro-max` `search.py --design-system --persist --page` (2026-11-01), then **edited by hand** to the direction the owner approved
**Dials:** Variance 5/10 | Motion 3/10 (subtle) | Density 3/10 public, 8/10 CRM
**Dark mode:** none for now (decision of 2026-11-01). Do not add `prefers-color-scheme` variants.
**Rule of content:** nothing here, and nothing built from it, may invent brand details, project facts, prices, testimonials, photography or floor plans. Missing content is a labelled placeholder.

### What the skill suggested and why it was NOT adopted

| Dataset suggestion | Decision | Reason (verified in the skill's own data) |
|---|---|---|
| Glassmorphism + teal/blue palette ("Real Estate: trust teal") | Rejected | Generic; clashes with the approved architectural/editorial direction |
| Cinzel + Josefin Sans | **Rejected** | Both list only `latin | latin-ext` subsets: **no Cyrillic, so Ukrainian would break** |
| Fraunces, Newsreader (other popular premium serifs) | Rejected | No Cyrillic subset either |
| "Hero-Centric", "Marketplace" and "Product Demo" patterns | Not used as given | Built for portals/SaaS; this is one developer's site and an internal tool |
| Minimalism & Swiss Style | **Adopted** (editorial variant) | Matches structure, grid and restraint; accessibility risk "low" in the dataset |
| Accessibility, touch, forms, loading, table rules | Adopted | See "Rules" below |

---

## Global Rules

### Colour tokens

All values are WCAG-checked (ratios computed, not estimated).

**Implemented today** in `src/app/globals.css`:

| Role | Hex | Token | Notes |
|---|---|---|---|
| Paper (background) | `#f4f0e8` | `--paper` | page background |
| Paper deep (alt surface) | `#ebe5d8` | `--paper-deep` | footer, bands, tags |
| Ink (text) | `#1a1812` | `--ink` | 15.6:1 on paper |
| Muted (secondary text) | `#5a554a` | `--muted` | 6.5:1 on paper, 5.9:1 on paper-deep, 7.4:1 on white |
| Line (hairline) | `#d6cebd` | `--line` | decorative rules only; never the only boundary of a control |
| Accent (terracotta) | `#9c4426` | `--accent` | 5.7:1 on paper; white on accent 6.4:1 |
| Stone (deep surface) | `#25302b` | `--stone` | paper on stone 12.0:1 |

**Proposed for the shared-tokens phase (Phase 2).** Semantic colours are *separate from the brand accent*, because terracotta currently means "new", "error", "delete" and "link hover" at once:

| Role | Text/icon | Tint background | Text on tint | Text on paper / white |
|---|---|---|---|---|
| Success | `#2f6b4f` | `#e3ece5` | 5.2:1 | 5.5 / 6.3 |
| Warning | `#7a4f00` | `#f3e8d0` | 5.9:1 | 6.3 / 7.1 |
| Danger | `#a3262a` | `#f3dcdb` | 5.6:1 | 6.4 / 7.3 |
| Info | `#2d4a6b` | `#dde6ef` | 7.2:1 | 8.0 / 9.1 |

Rules: colour is never the only signal (always icon + text); the brand accent is for primary emphasis and links, not for status; **placeholder text uses `--muted`** (≥4.5:1), never a lighter grey.

### Typography

Every typeface must cover **Polish (latin-ext), Ukrainian (cyrillic) and English**. Verified in the skill's `google-fonts` data: Cormorant Garamond (cyrillic, latin-ext), Inter (cyrillic, latin-ext).

| Use | Face | Rule |
|---|---|---|
| Display (public site, login wordmark) | Cormorant Garamond | Only at **32px and above**, weight 500, no italics unless needed; its thin hairlines fail at small sizes |
| Everything else (body, UI, forms, **entire CRM**) | Inter | Body 16px / line-height 1.5-1.6; labels 13-14px minimum; **no text below 12px, and tags/eyebrows at least 13px** |
| Numbers in tables, counts, dates, phone numbers | Inter with `font-variant-numeric: tabular-nums` | prevents layout shift in columns |

Type scale (px): 13 / 14 / 16 / 18 / 24 / 32 / 48 / 64 / 96-112 (display only, fluid with `clamp`). Line length 60-75 characters. Wrap rather than truncate; allow long words and e-mail addresses to break (`overflow-wrap: anywhere`).

Performance target (a goal to be measured, not a result): reduce font transfer from about 330-445 KB per page to under about 150 KB by loading one display weight and no italics for the public site and Inter only for the CRM.

### Spacing, shape, elevation

- 4/8 rhythm: 4, 8, 12, 16, 24, 32, 48, 64, 96. Container max-width 72rem (public); CRM full-width within the shell. Gutter 20px mobile, 32px from 768px.
- **Shape:** square corners (radius 0, at most 2px). Hairline 1px rules (`--line`) and 1px ink borders for controls.
- **Elevation:** flat. No shadows on cards. Overlays (menus, toasts) may use one soft shadow. No blur or glass effects.
- z-index scale: 0 / 10 / 20 / 40 (sticky header) / 50 (overlays and skip link).

### Components (core specs)

- **Button:** min-height 44px; primary = ink background, paper text; ghost = 1px ink border; hover only for fine pointers; `:active` scale 0.97; disabled opacity 0.5 with `cursor: not-allowed`; one primary button per view.
- **Field:** white background, 1px ink border, min-height 44px, visible label above (never placeholder-only), helper text when needed, error text below the field linked with `aria-describedby`, and an **error summary** (focusable, listing links to each invalid field) after a failed submit.
- **Checkbox / radio:** hit area at least **24x24px** (WCAG 2.2 AA); aim for 44px with the label as part of the target; visual box 20px minimum.
- **Tag / eyebrow:** 13px, Inter, uppercase tracking at most 0.12em.
- **Cards:** paper-tint surface, 1px hairline border, no shadow; hover lift only for fine pointers.
- **Focus:** 2px terracotta outline, 3px offset, always visible, never obscured by the sticky header (`scroll-padding-top` at least header height + 16px).

### Motion

Detailed rules come from the installed `emil-design-eng` skill. Tokens: ease-out `cubic-bezier(0.23, 1, 0.32, 1)`, ease-in-out `cubic-bezier(0.77, 0, 0.175, 1)`; UI feedback 100-200ms, overlays 200-300ms, exits about 60-70% of enter; animate `transform` and `opacity` only; stagger 30-50ms; at most 1-2 animated elements per view; **everything optional and gone under `prefers-reduced-motion`**. No GSAP: the existing CSS scroll-driven reveals and the `motion` library cover what is needed. (The dataset's GSAP snippet was not adopted.)

### Icons

One consistent SVG icon set (Phosphor `@phosphor-icons/react` is the skill's default; Lucide is acceptable) at one stroke weight. Decorative icons next to text are `aria-hidden`; icon-only controls need an accessible name. **No emoji as icons.** Chosen and installed in Phase 2, not before.

### Internationalisation rules

- Three locales, one source of truth (`messages/*.json`, keys must match; a test enforces it). Polish is the default.
- Design for the longest language: Ukrainian and Polish run 15-30% longer than English. No fixed widths on labels, buttons or the header; every layout is checked at 320, 360, 375, 390 px in all three locales.
- Use locale-aware formatting (`Intl`) for numbers, areas (m²), currency (PLN) and dates. Polish has three plural forms (1 / 2-4 / 5+, with the 12-14 and 22-24 rules); never write `count === 1 ? a : b`.
- Language switcher always reachable; labels use language codes consistently.

### Accessibility floor (all pages)

Contrast 4.5:1 (large text 3:1; UI boundaries and icons 3:1); keyboard order matches visual order; skip link first; sequential headings; labels on all fields; errors announced (`role="alert"` / `aria-live`); targets at least 24x24px (44px preferred); no content hidden behind sticky UI; reduced motion respected; no information by colour alone.

---

## Anti-Patterns (do NOT use)

- Fonts without Cyrillic coverage; text under 12px; low-contrast placeholder text
- Glass/blur effects, gradients as decoration, shadows as hierarchy, rounded "SaaS" cards
- Stock imagery presented as the project; **a rendering ever shown unlabelled or as a photograph**; invented specifications, prices, completion dates, testimonials or awards
- The terracotta accent doubling as the error/success colour
- Emojis as icons; hover-only interactions; layout-shifting hover transforms
- Hard-coded widths for text containers; truncation without a way to read the full text
- Any dark-mode styling (out of scope for now)

---

## Pre-Delivery Checklist

- [ ] Checked at 320, 360, 375, 390, 768, 1024, 1440 px; no horizontal scroll
- [ ] Checked in `/pl`, `/uk`, `/en` (and the Polish CRM)
- [ ] Contrast measured (text, placeholders, tags, status colours)
- [ ] Targets at least 24x24px, interactive controls 44px where space allows
- [ ] Keyboard-only walkthrough: skip link, focus visible and never hidden, error summary focus
- [ ] `prefers-reduced-motion: reduce` removes non-essential motion
- [ ] No invented content; placeholders labelled; renderings labelled
- [ ] Translation parity test, unit tests, lint, typecheck and build pass
