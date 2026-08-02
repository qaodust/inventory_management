import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Pure-function unit tests only (src/lib/**/*.test.ts) — no Postgres
// connection required. See vitest.integration.config.mts for the
// real-database suite.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/*.test.ts"],
  },
});
