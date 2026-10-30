// Public project content lives in code and messages/*.json (docs/decisions.md, row 6), keyed by slug.
//
// PLACEHOLDER ONLY. No real project, address, price or apartment data has been provided yet, so
// nothing here describes a real building. Replace with real content before launch. For an
// enquiry about a project to be accepted, a projects row with the same slug must exist in the
// database with is_active and is_published true (public.submit_lead checks it).

export type ProjectStatus = "planning" | "selling" | "completed";

export type ProjectEntry = {
  slug: string;
  status: ProjectStatus;
  isPlaceholder: boolean;
};

export const projects: readonly ProjectEntry[] = [
  { slug: "example-project", status: "planning", isPlaceholder: true },
];

export function getProject(slug: string): ProjectEntry | undefined {
  return projects.find((p) => p.slug === slug);
}
