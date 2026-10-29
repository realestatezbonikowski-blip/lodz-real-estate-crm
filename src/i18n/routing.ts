import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["pl", "uk", "en"],
  defaultLocale: "pl",
  localePrefix: "always",
});
