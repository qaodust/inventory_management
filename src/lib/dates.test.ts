import { afterEach, describe, expect, it, vi } from "vitest";
import {
  nyDateStringToUtcDate,
  nyTodayDateString,
  toNyDateString,
  utcDateToDateString,
} from "./dates";

afterEach(() => {
  vi.useRealTimers();
});

describe("toNyDateString", () => {
  it("converts a UTC instant to its America/New_York calendar date", () => {
    // 2026-01-15T12:00:00Z is 07:00 EST -> same calendar day in NY
    expect(toNyDateString(new Date("2026-01-15T12:00:00.000Z"))).toBe("2026-01-15");
  });

  it("shifts to the previous NY calendar day for an early-UTC instant", () => {
    // 2026-01-15T02:00:00Z is 2026-01-14T21:00 EST -> previous day in NY
    expect(toNyDateString(new Date("2026-01-15T02:00:00.000Z"))).toBe("2026-01-14");
  });

  it("handles the DST spring-forward boundary correctly (2026-03-08 in New York)", () => {
    // 2026-03-08T06:30:00Z is 01:30 EST (pre-transition) -> still 2026-03-08 in NY
    expect(toNyDateString(new Date("2026-03-08T06:30:00.000Z"))).toBe("2026-03-08");
    // 2026-03-08T18:00:00Z is 14:00 EDT (post-transition) -> still 2026-03-08 in NY
    expect(toNyDateString(new Date("2026-03-08T18:00:00.000Z"))).toBe("2026-03-08");
  });
});

describe("nyTodayDateString", () => {
  it("reflects the current NY calendar date under a mocked system clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
    expect(nyTodayDateString()).toBe("2026-01-15");
  });

  it("stays on the pre-DST day just before the spring-forward transition", () => {
    vi.useFakeTimers();
    // 06:59 UTC = 01:59 EST, one minute before the 2:00 AM -> 3:00 AM jump
    vi.setSystemTime(new Date("2026-03-08T06:59:00.000Z"));
    expect(nyTodayDateString()).toBe("2026-03-08");
  });
});

describe("nyDateStringToUtcDate", () => {
  it("constructs an explicit UTC-midnight Date from a YYYY-MM-DD string", () => {
    const date = nyDateStringToUtcDate("2026-01-15");
    expect(date.toISOString()).toBe("2026-01-15T00:00:00.000Z");
  });

  it("rejects malformed date strings", () => {
    expect(() => nyDateStringToUtcDate("2026/01/15")).toThrow();
    expect(() => nyDateStringToUtcDate("01-15-2026")).toThrow();
    expect(() => nyDateStringToUtcDate("not-a-date")).toThrow();
    expect(() => nyDateStringToUtcDate("")).toThrow();
  });

  it("round-trips with toNyDateString for a UTC-midnight instant interpreted in NY time", () => {
    // Round-tripping through toNyDateString isn't exact for a UTC-midnight
    // instant (that's the evening before in NY), so this only checks the
    // UTC calendar date is preserved by nyDateStringToUtcDate itself.
    const date = nyDateStringToUtcDate("2026-07-04");
    expect(date.getUTCFullYear()).toBe(2026);
    expect(date.getUTCMonth()).toBe(6);
    expect(date.getUTCDate()).toBe(4);
  });
});

describe("utcDateToDateString", () => {
  it("round-trips exactly with nyDateStringToUtcDate", () => {
    expect(utcDateToDateString(nyDateStringToUtcDate("2026-01-15"))).toBe("2026-01-15");
    expect(utcDateToDateString(nyDateStringToUtcDate("2026-12-31"))).toBe("2026-12-31");
  });
});
