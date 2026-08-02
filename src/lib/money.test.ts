import { describe, expect, it } from "vitest";
import {
  allocationCostCents,
  centsToDecimal,
  computeUnitCosts,
  decimalToCents,
  formatCents,
  recomputeBatchAllocations,
} from "./money";

describe("decimalToCents / centsToDecimal", () => {
  it("converts a dollar string to cents", () => {
    expect(decimalToCents("12.34")).toBe(1234);
  });

  it("converts a number to cents", () => {
    expect(decimalToCents(12.34)).toBe(1234);
  });

  it("round-trips cents back to a Decimal", () => {
    expect(centsToDecimal(1234).toString()).toBe("12.34");
  });

  it("handles zero", () => {
    expect(decimalToCents("0")).toBe(0);
    expect(centsToDecimal(0).toString()).toBe("0");
  });
});

describe("formatCents", () => {
  it("formats as USD currency", () => {
    expect(formatCents(123456)).toBe("$1,234.56");
  });

  it("formats zero", () => {
    expect(formatCents(0)).toBe("$0.00");
  });
});

describe("computeUnitCosts", () => {
  it("splits evenly when totalCents is a multiple of quantity", () => {
    expect(computeUnitCosts(1000, 10)).toEqual({ baseCents: 100, remainderCents: 0 });
  });

  it("computes the remainder when it doesn't divide evenly", () => {
    // 1000 cents / 3 units = 333 base, remainder 1
    expect(computeUnitCosts(1000, 3)).toEqual({ baseCents: 333, remainderCents: 1 });
  });

  it("throws for non-positive quantity", () => {
    expect(() => computeUnitCosts(1000, 0)).toThrow();
    expect(() => computeUnitCosts(1000, -1)).toThrow();
  });
});

describe("allocationCostCents", () => {
  it("assigns exactly the base cost when there is no remainder", () => {
    // 1000 / 10 = 100 base, 0 remainder
    expect(allocationCostCents(1000, 10, 0, 5)).toBe(500);
    expect(allocationCostCents(1000, 10, 5, 5)).toBe(500);
  });

  it("assigns the remainder pennies to the first units in FIFO order", () => {
    // 1000 / 3 = 333 base, remainder 1 -> unit 0 gets 334, units 1-2 get 333
    expect(allocationCostCents(1000, 3, 0, 1)).toBe(334);
    expect(allocationCostCents(1000, 3, 1, 1)).toBe(333);
    expect(allocationCostCents(1000, 3, 2, 1)).toBe(333);
    // whole batch in one allocation sums to the exact total
    expect(allocationCostCents(1000, 3, 0, 3)).toBe(1000);
  });

  it("handles an allocation range that straddles the remainder boundary", () => {
    // 1000 / 7 = 142 base, remainder 6 (units 0-5 get 143, unit 6 gets 142)
    // allocation [4, 7) overlaps remainder units 4,5 (2 units) + unit 6 (base only)
    const cost = allocationCostCents(1000, 7, 4, 3);
    expect(cost).toBe(143 + 143 + 142);
  });

  it("throws for a negative start", () => {
    expect(() => allocationCostCents(1000, 10, -1, 5)).toThrow();
  });

  it("throws for a non-positive allocQty", () => {
    expect(() => allocationCostCents(1000, 10, 0, 0)).toThrow();
  });

  it("throws when the range exceeds the batch quantity", () => {
    expect(() => allocationCostCents(1000, 10, 8, 5)).toThrow();
  });
});

describe("recomputeBatchAllocations", () => {
  it("assigns contiguous start indices in order", () => {
    const result = recomputeBatchAllocations(1000, 10, [
      { id: "a", quantity: 3 },
      { id: "b", quantity: 7 },
    ]);
    expect(result).toEqual([
      { id: "a", unitStartIndex: 0, costBasisCents: 300 },
      { id: "b", unitStartIndex: 3, costBasisCents: 700 },
    ]);
  });

  it("sums back to the exact total across all allocations", () => {
    const result = recomputeBatchAllocations(1000, 3, [
      { id: "a", quantity: 1 },
      { id: "b", quantity: 1 },
      { id: "c", quantity: 1 },
    ]);
    const sum = result.reduce((acc, r) => acc + r.costBasisCents, 0);
    expect(sum).toBe(1000);
  });

  it("re-derives contiguous indices after a shrink (an allocation removed)", () => {
    // Original: a=3 (start 0), b=4 (start 3), c=3 (start 7), total qty 10
    // After removing b, repack from scratch against the survivors [a, c]:
    const result = recomputeBatchAllocations(1000, 10, [
      { id: "a", quantity: 3 },
      { id: "c", quantity: 3 },
    ]);
    expect(result).toEqual([
      { id: "a", unitStartIndex: 0, costBasisCents: 300 },
      { id: "c", unitStartIndex: 3, costBasisCents: 300 },
    ]);
  });

  it("throws when allocations consume more than the batch quantity", () => {
    expect(() =>
      recomputeBatchAllocations(1000, 5, [
        { id: "a", quantity: 3 },
        { id: "b", quantity: 3 },
      ])
    ).toThrow();
  });

  it("returns an empty array for no allocations", () => {
    expect(recomputeBatchAllocations(1000, 10, [])).toEqual([]);
  });
});

describe("fuzz: unit costs always sum to the exact total", () => {
  it("holds across ~500 randomized (totalCents, quantity, split) combinations", () => {
    for (let i = 0; i < 500; i++) {
      const totalCents = Math.floor(Math.random() * 1_000_000);
      const quantity = 1 + Math.floor(Math.random() * 50);

      // Randomly partition `quantity` units into a handful of contiguous
      // allocations (each gets at least 1 unit, in order).
      const allocations: { id: string; quantity: number }[] = [];
      let remaining = quantity;
      let idx = 0;
      while (remaining > 0) {
        const takeAllRest = remaining === 1 || Math.random() < 0.4;
        const qty = takeAllRest ? remaining : 1 + Math.floor(Math.random() * (remaining - 1));
        allocations.push({ id: `alloc-${idx}`, quantity: qty });
        remaining -= qty;
        idx++;
      }

      const result = recomputeBatchAllocations(totalCents, quantity, allocations);
      const sum = result.reduce((acc, r) => acc + r.costBasisCents, 0);
      expect(sum, `totalCents=${totalCents} quantity=${quantity}`).toBe(totalCents);
    }
  });
});
