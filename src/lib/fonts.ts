import { Inter } from "next/font/google";

// latin-ext covers Polish diacritics; cyrillic covers Ukrainian. Inter is a variable font, so every
// weight (400/500/600/700) comes from the same file per subset.
export const inter = Inter({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});
