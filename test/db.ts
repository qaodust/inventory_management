import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { assertSafeTestTarget } from "./db-guard";

/**
 * The `?schema=` query param is understood by Prisma's CLI/migration
 * engine natively, but @prisma/adapter-pg forwards the connection
 * string to node-postgres as-is — node-postgres has no idea what
 * `schema` means, so it's silently ignored there. To make the test
 * client actually land on the right schema we strip it out and set
 * Postgres's `search_path` explicitly via the libpq `options` startup
 * parameter instead, which node-postgres applies per physical
 * connection (works correctly through pooling).
 */
function splitSchemaFromConnectionString(raw: string): {
  connectionString: string;
  schema: string;
} {
  const url = new URL(raw);
  const schema = url.searchParams.get("schema");
  if (!schema) {
    throw new Error(
      `TEST_DATABASE_URL must include a ?schema= query param, got: ${raw}`
    );
  }
  url.searchParams.delete("schema");
  return { connectionString: url.toString(), schema };
}

function requireTestDatabaseUrl(): string {
  const testUrl = process.env.TEST_DATABASE_URL;
  const appUrl = process.env.DATABASE_URL;
  if (!testUrl) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Integration tests must run against a " +
        "dedicated test schema, never the app's real DATABASE_URL."
    );
  }
  assertSafeTestTarget(testUrl, appUrl);
  return testUrl;
}

const { connectionString, schema } = splitSchemaFromConnectionString(
  requireTestDatabaseUrl()
);

// The pg-level `options` (libpq search_path) makes our own raw $queryRaw
// calls (unqualified table names in locking.ts, resetTestDb below) resolve
// against the test schema. The adapter-level `schema` option is separate
// and required for Prisma's own generated model queries (.create/.findMany/
// etc.) to schema-qualify correctly — without it they hard-code "public"
// regardless of search_path, silently writing test fixtures into the real
// dev schema.
const adapter = new PrismaPg(
  {
    connectionString,
    options: `-c search_path=${schema}`,
  },
  { schema }
);

export const testPrisma = new PrismaClient({ adapter });
export const testSchema = schema;

const TABLES = [
  "SaleAllocation",
  "Sale",
  "InventoryAdjustment",
  "Shipment",
  "SaleRoute",
  "Product",
  "Category",
  "Manufacturer",
  "User",
] as const;

/** Wipes every business table in the test schema. Run between tests, not inside a wrapping transaction, since concurrency tests need genuinely independent transactions. */
export async function resetTestDb() {
  const quoted = TABLES.map((t) => `"${t}"`).join(", ");
  await testPrisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`
  );
}
