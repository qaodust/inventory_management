import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Integration tests that hit a real Postgres connection (test/integration/**).
// Requires TEST_DATABASE_URL — see test/global-setup.ts.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["test/integration/**/*.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    setupFiles: ["./test/setup.ts"],
    // Test files share one Postgres test schema and truncate it between
    // every test — running files in parallel would let one file's
    // truncate wipe data another file is mid-way through using.
    fileParallelism: false,
    testTimeout: 15_000,
  },
});
