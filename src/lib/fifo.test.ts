import { describe, expect, it } from "vitest";
import { selectFifoBatches, type FifoCandidate } from "./fifo";

function candidate(shipmentId: string, arrivalDate: string, remainingQty: number): FifoCandidate {
  return { shipmentId, arrivalDate: new Date(arrivalDate), remainingQty };
}

describe("selectFifoBatches", () => {
  it("consumes a single batch when it has enough stock", () => {
    const result = selectFifoBatches([candidate("a", "2026-01-01", 10)], 5);
    expect(result).toEqual({ ok: true, allocations: [{ shipmentId: "a", quantity: 5 }] });
  });

  it("spans multiple batches in arrival-date order", () => {
    const candidates = [
      candidate("b", "2026-01-02", 5),
      candidate("a", "2026-01-01", 5),
    ];
    const result = selectFifoBatches(candidates, 8);
    expect(result).toEqual({
      ok: true,
      allocations: [
        { shipmentId: "a", quantity: 5 },
        { shipmentId: "b", quantity: 3 },
      ],
    });
  });

  it("uses shipmentId as a stable tie-breaker for same-day arrivals", () => {
    const candidates = [
      candidate("z", "2026-01-01", 5),
      candidate("a", "2026-01-01", 5),
    ];
    const result = selectFifoBatches(candidates, 6);
    expect(result).toEqual({
      ok: true,
      allocations: [
        { shipmentId: "a", quantity: 5 },
        { shipmentId: "z", quantity: 1 },
      ],
    });
  });

  it("reports insufficient stock without allocating anything partially past what's available", () => {
    const candidates = [candidate("a", "2026-01-01", 3), candidate("b", "2026-01-02", 2)];
    const result = selectFifoBatches(candidates, 10);
    expect(result).toEqual({ ok: false, insufficientBy: 5 });
  });

  it("ignores candidates with zero or negative remaining quantity", () => {
    const candidates = [
      candidate("a", "2026-01-01", 0),
      candidate("b", "2026-01-02", 10),
    ];
    const result = selectFifoBatches(candidates, 4);
    expect(result).toEqual({ ok: true, allocations: [{ shipmentId: "b", quantity: 4 }] });
  });

  it("exactly exhausts stock with no leftover", () => {
    const candidates = [candidate("a", "2026-01-01", 5), candidate("b", "2026-01-02", 5)];
    const result = selectFifoBatches(candidates, 10);
    expect(result).toEqual({
      ok: true,
      allocations: [
        { shipmentId: "a", quantity: 5 },
        { shipmentId: "b", quantity: 5 },
      ],
    });
  });

  it("throws for a non-positive neededQty", () => {
    expect(() => selectFifoBatches([], 0)).toThrow();
    expect(() => selectFifoBatches([], -1)).toThrow();
  });

  it("reports fully insufficient when there are no candidates at all", () => {
    expect(selectFifoBatches([], 5)).toEqual({ ok: false, insufficientBy: 5 });
  });
});
