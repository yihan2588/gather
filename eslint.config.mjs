import { defineConfig, globalIgnores } from "eslint/config";
import next from "eslint-config-next/core-web-vitals";
import ts from "eslint-config-next/typescript";
export default defineConfig([
  ...next,
  ...ts,
  globalIgnores([
    ".next/**",
    ".local-demo/**",
    "test-results/**",
    "playwright-report/**",
    "src/lib/database.types.ts",
    "next-env.d.ts",
  ]),
]);
