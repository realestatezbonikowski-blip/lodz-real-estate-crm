import { Inter } from "next/font/google";

// latin-ext covers Polish diacritics; cyrillic covers Ukrainian.
export const inter = Inter({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});
