import { Cormorant_Garamond, Inter } from "next/font/google";

// latin-ext covers Polish diacritics; cyrillic covers Ukrainian.
export const inter = Inter({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

// Provisional display face for headlines (swap with the brand typeface once it is chosen).
export const display = Cormorant_Garamond({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display-face",
  display: "swap",
});
