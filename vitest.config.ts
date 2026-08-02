import path from "node:path";
import { defineConfig } from "vitest/config";

// Pure-function unit tests only (src/lib/**/*.test.ts) — no Postgres
// connection required. See vitest.integration.config.ts for the
// real-database suite.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
