import { Prisma } from "@/generated/prisma/client";

/**
 * All currency columns are `Decimal(12,2)` (exact, never floating point).
 * Business math (FIFO cost allocation, remainder-penny reconciliation)
 * is done in plain integer cents at this module's boundary — Decimal.js
 * arithmetic is intentionally kept out of the rest of the codebase.
 */
export function decimalToCents(value: Prisma.Decimal | string | number): number {
  const decimal = new Prisma.Decimal(value);
  return decimal.times(100).toDecimalPlaces(0).toNumber();
}

export function centsToDecimal(cents: number): Prisma.Decimal {
  return new Prisma.Decimal(cents).dividedBy(100);
}

/** Display-only formatting, e.g. 123456 -> "$1,234.56". Never use this output as a stored or computed value. */
export function formatCents(cents: number): string {
  return centsToDecimal(cents).toNumber().toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export interface UnitCostBreakdown {
  /** Cost in cents assigned to every unit in the batch. */
  baseCents: number;
  /** How many of the batch's units (the first N in FIFO order) get baseCents + 1 instead. */
  remainderCents: number;
}

/**
 * Splits a batch's total cost (product cost + shipping fee, in cents)
 * across `quantity` units so the per-unit costs sum back to the exact
 * total even when it doesn't divide evenly.
 */
export function computeUnitCosts(totalCents: number, quantity: number): UnitCostBreakdown {
  if (quantity <= 0) throw new Error(`quantity must be positive, got ${quantity}`);
  return {
    baseCents: Math.floor(totalCents / quantity),
    remainderCents: totalCents % quantity,
  };
}

/**
 * Cost basis (in cents) for an allocation consuming the contiguous unit
 * range [start, start + allocQty) of a batch, given the batch's total
 * cost and quantity. Closed-form — no per-unit loop.
 */
export function allocationCostCents(
  totalCents: number,
  quantity: number,
  start: number,
  allocQty: number
): number {
  if (start < 0) throw new Error(`start must be >= 0, got ${start}`);
  if (allocQty <= 0) throw new Error(`allocQty must be positive, got ${allocQty}`);
  if (start + allocQty > quantity) {
    throw new Error(
      `allocation range [${start}, ${start + allocQty}) exceeds batch quantity ${quantity}`
    );
  }
  const { baseCents, remainderCents } = computeUnitCosts(totalCents, quantity);
  const overlap = Math.max(0, Math.min(start + allocQty, remainderCents) - start);
  return allocQty * baseCents + overlap;
}

export interface OrderedAllocationInput {
  id: string;
  quantity: number;
}

export interface RecomputedAllocation {
  id: string;
  unitStartIndex: number;
  costBasisCents: number;
}

/**
 * Re-derives every allocation's unitStartIndex/costBasisCents for a
 * batch from scratch, given the batch's (totalCents, quantity) and its
 * surviving allocations in true chronological order (SaleAllocation.sequence
 * ascending). Pure function — call this after any add/remove/resize of a
 * batch's allocations, or after a change to the batch's own total cost;
 * never patch start indices incrementally.
 */
export function recomputeBatchAllocations(
  totalCents: number,
  quantity: number,
  orderedAllocations: OrderedAllocationInput[]
): RecomputedAllocation[] {
  let cursor = 0;
  const result: RecomputedAllocation[] = [];
  for (const allocation of orderedAllocations) {
    const start = cursor;
    const costBasisCents = allocationCostCents(totalCents, quantity, start, allocation.quantity);
    result.push({ id: allocation.id, unitStartIndex: start, costBasisCents });
    cursor += allocation.quantity;
  }
  if (cursor > quantity) {
    throw new Error(
      `allocations consume ${cursor} units but batch quantity is only ${quantity}`
    );
  }
  return result;
}
