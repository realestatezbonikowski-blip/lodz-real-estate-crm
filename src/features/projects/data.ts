// Public project content lives in code and messages/*.json (docs/decisions.md, row 6), keyed by slug.
//
// Everything here is either VERIFIED or explicitly PENDING. A fact with `value: null` is rendered
// as "to be confirmed"; nothing is guessed. To publish verified data, fill the value (and, for
// translatable text, add the keys to messages/*.json) and set the matching media `src`. No page
// code changes are needed. See docs/content-needed.md for the full list of what must be supplied.
//
// For an enquiry about a project to be accepted, a projects row with the same slug must exist in
// the database with is_active and is_published true (public.submit_lead checks it).

export type ProjectStatus = "planning" | "selling" | "completed";

export type FactId = "location" | "units" | "floors" | "completion" | "pricing";

/** What a media item is. Never present a render as a photograph: the label always shows the kind. */
export type MediaKind = "visualization" | "sketch" | "floorplan" | "photo";

export type ProjectFact = {
  id: FactId;
  /** null = not confirmed yet. Free text, shown as-is (numbers, dates and prices need verification). */
  value: string | null;
};

export type ProjectMedia = {
  kind: MediaKind;
  /** Path under /public, e.g. "/projects/rodomska/render-1.webp". Absent = placeholder card. */
  src?: string;
  width?: number;
  height?: number;
  /** Alt text per locale, required together with `src`. */
  alt?: Record<"pl" | "uk" | "en", string>;
};

export type ProjectEntry = {
  slug: string;
  status: ProjectStatus;
  /** True while the project's data has not been confirmed by the developer. */
  provisional: boolean;
  facts: readonly ProjectFact[];
  media: readonly ProjectMedia[];
};

export const projects: readonly ProjectEntry[] = [
  {
    // "Rodomska" is the working name given for the Łódź development. The status, counts, dates and
    // prices below are NOT confirmed and are therefore left empty.
    slug: "rodomska",
    status: "planning",
    provisional: true,
    facts: [
      { id: "location", value: "Łódź" },
      { id: "units", value: null },
      { id: "floors", value: null },
      { id: "completion", value: null },
      { id: "pricing", value: null },
    ],
    media: [{ kind: "visualization" }, { kind: "sketch" }, { kind: "floorplan" }],
  },
];

export function getProject(slug: string): ProjectEntry | undefined {
  return projects.find((p) => p.slug === slug);
}
