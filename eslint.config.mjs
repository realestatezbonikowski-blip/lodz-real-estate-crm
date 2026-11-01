import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // .claude/ holds third-party agent skills (their own scripts), not application code.
  globalIgnores([".next/**", "out/**", "next-env.d.ts", ".claude/**"]),
]);
