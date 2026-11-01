import { notFound } from "next/navigation";

// Any unknown path under /pl, /uk or /en lands here and is turned into a 404 INSIDE the locale
// layout, so the visitor gets the localised, styled not-found page (header, footer, right language)
// instead of Next.js's bare default. Unprefixed unknown paths are first redirected to /pl/... by the
// locale middleware and end up here too. More specific routes (projects, contact, privacy) win.
export default function UnknownRoute() {
  notFound();
}
