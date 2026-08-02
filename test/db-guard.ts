/** The one schema name integration tests are ever allowed to run (and truncate) against. */
export const REQUIRED_TEST_SCHEMA = "test";

export interface ConnectionTarget {
  host: string;
  port: string;
  database: string;
  schema: string;
}

/**
 * Normalizes a Postgres connection string down to the fields that
 * actually determine where queries land, defaulting an absent `schema`
 * param to Postgres's own default (`public`) rather than treating it as
 * "no schema" — that's the gap a raw string comparison misses (e.g.
 * `DATABASE_URL` with no `?schema=` and `...?schema=public` are
 * different strings but the same physical target).
 */
export function parseConnectionTarget(raw: string): ConnectionTarget {
  const url = new URL(raw);
  return {
    host: url.hostname,
    port: url.port || "5432",
    database: url.pathname.replace(/^\//, ""),
    schema: url.searchParams.get("schema") || "public",
  };
}

export function sameConnectionTarget(a: ConnectionTarget, b: ConnectionTarget): boolean {
  return a.host === b.host && a.port === b.port && a.database === b.database && a.schema === b.schema;
}

/**
 * Throws unless `testUrl` is safe to run integration tests (and
 * unconditional TRUNCATEs) against: it must target exactly
 * `?schema=test`, and must not resolve to the same physical
 * host/port/database/schema as `appUrl` even if the two connection
 * strings differ as raw text.
 */
export function assertSafeTestTarget(testUrl: string, appUrl: string | undefined): void {
  const testTarget = parseConnectionTarget(testUrl);
  if (testTarget.schema !== REQUIRED_TEST_SCHEMA) {
    throw new Error(
      `TEST_DATABASE_URL must use exactly ?schema=${REQUIRED_TEST_SCHEMA}, got ` +
        `schema=${testTarget.schema}. Refusing to run — this schema gets ` +
        `truncated between every test.`
    );
  }

  if (appUrl) {
    const appTarget = parseConnectionTarget(appUrl);
    if (sameConnectionTarget(testTarget, appTarget)) {
      throw new Error(
        "TEST_DATABASE_URL resolves to the same host/port/database/schema as " +
          "DATABASE_URL — tests would run against (and truncate) real business " +
          "data. A raw string comparison would have missed this if the two " +
          "connection strings differ only in incidental formatting/param order."
      );
    }
  }
}
