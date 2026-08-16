import { describe, expect, it } from "vitest";
import { saleProfitCents } from "./sales";

describe("saleProfitCents", () => {
  it("computes revenue minus summed allocation cost basis", () => {
    const profit = saleProfitCents({
      pricePerUnit: "25.00",
      quantity: 4,
      allocations: [{ costBasisCents: 3000 }, { costBasisCents: 1500 }],
    });
    expect(profit).toBe(10000 - 4500); // (25 * 4 * 100) - 4500
  });

  it("can be negative when cost basis exceeds revenue", () => {
    const profit = saleProfitCents({
      pricePerUnit: "5.00",
      quantity: 2,
      allocations: [{ costBasisCents: 2000 }],
    });
    expect(profit).toBe(1000 - 2000);
  });
});
