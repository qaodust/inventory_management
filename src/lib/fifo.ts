export interface FifoCandidate {
  shipmentId: string;
  arrivalDate: Date;
  remainingQty: number;
}

export interface FifoAllocationPlan {
  shipmentId: string;
  quantity: number;
}

export type FifoSelectionResult =
  | { ok: true; allocations: FifoAllocationPlan[] }
  | { ok: false; insufficientBy: number };

/**
 * Greedily consumes oldest-arrived batches first (arrivalDate ascending,
 * shipmentId ascending as a stable tie-break — there's no real business
 * meaning to which of two same-day batches is "older", it just needs to
 * be consistent) until `neededQty` is satisfied or candidates run out.
 * Pure function: caller is responsible for having already locked the
 * candidate rows and computed their true remaining quantity.
 */
export function selectFifoBatches(
  candidates: FifoCandidate[],
  neededQty: number
): FifoSelectionResult {
  if (neededQty <= 0) {
    throw new Error(`neededQty must be positive, got ${neededQty}`);
  }

  const ordered = [...candidates]
    .filter((c) => c.remainingQty > 0)
    .sort((a, b) => {
      const dateDiff = a.arrivalDate.getTime() - b.arrivalDate.getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.shipmentId < b.shipmentId ? -1 : a.shipmentId > b.shipmentId ? 1 : 0;
    });

  const allocations: FifoAllocationPlan[] = [];
  let remaining = neededQty;

  for (const candidate of ordered) {
    if (remaining <= 0) break;
    const take = Math.min(candidate.remainingQty, remaining);
    allocations.push({ shipmentId: candidate.shipmentId, quantity: take });
    remaining -= take;
  }

  if (remaining > 0) {
    return { ok: false, insufficientBy: remaining };
  }
  return { ok: true, allocations };
}
