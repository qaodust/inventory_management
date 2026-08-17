import { describe, expect, it } from "vitest";
import { sortReportRows } from "./reports";

describe("sortReportRows", () => {
  it("sorts ascending or descending by the accessor", () => {
    const rows = [{ v: 3 }, { v: 1 }, { v: 2 }];
    expect(sortReportRows(rows, (r) => r.v, "asc").map((r) => r.v)).toEqual([1, 2, 3]);
    expect(sortReportRows(rows, (r) => r.v, "desc").map((r) => r.v)).toEqual([3, 2, 1]);
  });

  it("sorts null accessor values last regardless of direction", () => {
    const rows = [{ v: 2 }, { v: null }, { v: 1 }];
    expect(sortReportRows(rows, (r) => r.v, "asc").map((r) => r.v)).toEqual([1, 2, null]);
    expect(sortReportRows(rows, (r) => r.v, "desc").map((r) => r.v)).toEqual([2, 1, null]);
  });

  it("does not mutate the input array", () => {
    const rows = [{ v: 2 }, { v: 1 }];
    sortReportRows(rows, (r) => r.v, "asc");
    expect(rows.map((r) => r.v)).toEqual([2, 1]);
  });
});
