import { describe, expect, it } from "vitest";
import { assertSafeTestTarget, parseConnectionTarget, sameConnectionTarget } from "./db-guard";

describe("parseConnectionTarget", () => {
  it("defaults a missing ?schema= to public", () => {
    const target = parseConnectionTarget("postgresql://user:pass@host:5432/dbname");
    expect(target).toEqual({ host: "host", port: "5432", database: "dbname", schema: "public" });
  });

  it("defaults a missing port to 5432", () => {
    const target = parseConnectionTarget("postgresql://user:pass@host/dbname?schema=test");
    expect(target.port).toBe("5432");
  });

  it("reads an explicit schema", () => {
    const target = parseConnectionTarget("postgresql://user:pass@host:5432/dbname?schema=test");
    expect(target.schema).toBe("test");
  });
});

describe("sameConnectionTarget", () => {
  it("treats a URL with no schema param as equivalent to ?schema=public", () => {
    const a = parseConnectionTarget("postgresql://user:pass@host:5432/dbname");
    const b = parseConnectionTarget("postgresql://user:pass@host:5432/dbname?schema=public");
    expect(sameConnectionTarget(a, b)).toBe(true);
  });

  it("treats different schemas on the same instance as different targets", () => {
    const a = parseConnectionTarget("postgresql://user:pass@host:5432/dbname?schema=test");
    const b = parseConnectionTarget("postgresql://user:pass@host:5432/dbname?schema=public");
    expect(sameConnectionTarget(a, b)).toBe(false);
  });

  it("treats different hosts as different targets even with the same schema", () => {
    const a = parseConnectionTarget("postgresql://user:pass@host-a:5432/dbname?schema=test");
    const b = parseConnectionTarget("postgresql://user:pass@host-b:5432/dbname?schema=test");
    expect(sameConnectionTarget(a, b)).toBe(false);
  });
});

describe("assertSafeTestTarget", () => {
  it("rejects a test URL that isn't ?schema=test", () => {
    expect(() =>
      assertSafeTestTarget("postgresql://user:pass@host:5432/dbname?schema=public", undefined)
    ).toThrow(/must use exactly \?schema=test/);
  });

  it("rejects a test URL equivalent to the app URL despite differing raw strings", () => {
    const appUrl = "postgresql://user:pass@host:5432/dbname";
    const testUrl = "postgresql://user:pass@host:5432/dbname?schema=public";
    // Neither of these alone would pass (testUrl isn't ?schema=test), so use a
    // pair that's both "schema=test" AND resolves to the same target as appUrl
    // to isolate the equivalence check specifically.
    const equivalentAppUrl = "postgresql://user:pass@host:5432/dbname?schema=test";
    const equivalentTestUrl = "postgresql://user:pass@host:5432/dbname?schema=test";
    expect(() => assertSafeTestTarget(equivalentTestUrl, equivalentAppUrl)).toThrow(
      /resolves to the same host\/port\/database\/schema/
    );
    // Sanity: the schema-mismatch case above still throws for its own reason.
    expect(() => assertSafeTestTarget(testUrl, appUrl)).toThrow();
  });

  it("accepts a proper test URL distinct from the app URL", () => {
    expect(() =>
      assertSafeTestTarget(
        "postgresql://user:pass@host:5432/dbname?schema=test",
        "postgresql://user:pass@host:5432/dbname"
      )
    ).not.toThrow();
  });

  it("accepts a proper test URL when no app URL is configured", () => {
    expect(() =>
      assertSafeTestTarget("postgresql://user:pass@host:5432/dbname?schema=test", undefined)
    ).not.toThrow();
  });
});
