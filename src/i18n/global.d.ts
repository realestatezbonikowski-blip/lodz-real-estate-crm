import type { routing } from "./routing";
import type messages from "../../messages/pl.json";

// Typed locales and message keys: a missing key is a compile error.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
