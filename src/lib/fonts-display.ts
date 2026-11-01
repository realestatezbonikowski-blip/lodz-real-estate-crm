import { Cormorant_Garamond } from "next/font/google";

// Public-site display headings only (>= 32px, weight 500). Kept out of fonts.ts so the CRM, which is
// Inter-only, never imports it. No 600 or italic: neither is rendered anywhere.
// Provisional: swap with the brand typeface once it is chosen.
export const display = Cormorant_Garamond({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["500"],
  variable: "--font-display-face",
  display: "swap",
  preload: false,
});
