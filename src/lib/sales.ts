import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { nyDateStringToUtcDate, nyTodayDateString } from "./dates";
import { selectFifoBatches, type FifoCandidate } from "./fifo";
import { allocationCostCents, decimalToCents } from "./money";
import {
  getRemainingQty,
  lockArrivedShipmentsForProduct,
  lockShipments,
  type LockedShipmentRow,
} from "./locking";
import { repackShipmentAllocations } from "./allocations";

export class InsufficientStockError extends Error {
  constructor(public readonly insufficientBy: number) {
    super(`Insufficient stock: short by ${insufficientBy} unit(s)`);
    this.name = "InsufficientStockError";
  }
}

/**
 * Resolves the sale route a sale form submitted: reuses an existing
 * route by case-insensitive name match, or creates one, when
 * `newSaleRouteName` is set (the form's inline "add new route" option)
 * — otherwise passes `saleRouteId` straight through. Routes are an
 * extensible user-managed list, so adding one inline should never
 * require a deployment or hit a duplicate error.
 */
async function resolveSaleRoute(
  tx: Prisma.TransactionClient,
  saleRouteId: string | null | undefined,
  newSaleRouteName: string | null | undefined
): Promise<string> {
  const trimmedNew = newSaleRouteName?.trim();
  if (trimmedNew) {
    const existing = await tx.saleRoute.findFirst({
      where: { name: { equals: trimmedNew, mode: "insensitive" } },
    });
    if (existing) return existing.id;
    const created = await tx.saleRoute.create({ data: { name: trimmedNew } });
    return created.id;
  }
  if (!saleRouteId) throw new Error("Sale route is required.");
  return saleRouteId;
}

export interface CreateSaleInput {
  productId: string;
  quantity: number;
  /** Dollars — a Decimal-compatible string or number, e.g. "12.50". */
  pricePerUnit: string | number;
  saleRouteId?: string | null;
  /** Inline "add new route" option — takes precedence over saleRouteId when set. */
  newSaleRouteName?: string | null;
  loggedByUserId: string;
}

export interface EditSaleInput {
  quantity: number;
  pricePerUnit: string | number;
  saleRouteId?: string | null;
  /** Inline "add new route" option — takes precedence over saleRouteId when set. */
  newSaleRouteName?: string | null;
}

function toFifoCandidates(
  locked: LockedShipmentRow[],
  remaining: Map<string, number>
): FifoCandidate[] {
  return locked.map((s) => ({
    shipmentId: s.id,
    // lockArrivedShipmentsForProduct only ever returns rows with
    // arrivalDate IS NOT NULL — non-null here by construction.
    arrivalDate: s.arrivalDate!,
    remainingQty: remaining.get(s.id) ?? 0,
  }));
}

/**
 * Creates a sale: validates stock, FIFO-allocates it across one or more
 * batches, and records each allocation's cost basis — all inside one
 * transaction with row-level protection against a simultaneous sale
 * overselling the same batch. Rejects the whole sale (no partial
 * fulfillment) if stock is insufficient. Sale date is always "today"
 * in America/New_York — never client-supplied, by design (no backdating).
 */
export async function createSale(prisma: PrismaClient, input: CreateSaleInput) {
  return prisma.$transaction(async (tx) => {
    const saleRouteId = await resolveSaleRoute(tx, input.saleRouteId, input.newSaleRouteName);
    const locked = await lockArrivedShipmentsForProduct(tx, input.productId);
    const remaining = await getRemainingQty(tx, locked.map((s) => s.id));
    const selection = selectFifoBatches(toFifoCandidates(locked, remaining), input.quantity);
    if (!selection.ok) {
      throw new InsufficientStockError(selection.insufficientBy);
    }

    const sale = await tx.sale.create({
      data: {
        productId: input.productId,
        quantity: input.quantity,
        pricePerUnit: input.pricePerUnit,
        saleRouteId,
        saleDate: nyDateStringToUtcDate(nyTodayDateString()),
        loggedByUserId: input.loggedByUserId,
      },
    });

    const byId = new Map(locked.map((s) => [s.id, s]));

    // Creation only ever appends to the end of each batch's existing
    // chain, so each new allocation can be costed directly — no repack
    // of prior allocations is needed here (unlike edit/delete).
    for (const plan of selection.allocations) {
      const shipment = byId.get(plan.shipmentId)!;
      const totalCents = decimalToCents(shipment.productCost) + decimalToCents(shipment.shippingFee);
      const priorAllocations = await tx.saleAllocation.findMany({
        where: { shipmentId: plan.shipmentId },
        select: { quantity: true },
      });
      const priorUnits = priorAllocations.reduce((sum, a) => sum + a.quantity, 0);
      const costBasisCents = allocationCostCents(
        totalCents,
        shipment.quantityOrdered,
        priorUnits,
        plan.quantity
      );
      await tx.saleAllocation.create({
        data: {
          saleId: sale.id,
          shipmentId: plan.shipmentId,
          quantity: plan.quantity,
          unitStartIndex: priorUnits,
          costBasisCents,
        },
      });
    }

    return tx.sale.findUniqueOrThrow({
      where: { id: sale.id },
      include: { allocations: true },
    });
  });
}

/**
 * Edits a sale's quantity/price/route. Always re-runs FIFO fresh for
 * the new quantity (it may land on a different batch set than before —
 * correct, since capacity may have changed) and fully repacks every
 * batch touched by either the old or new allocation set, since removing
 * an allocation shifts everything after it in that batch's chain.
 */
export async function editSale(prisma: PrismaClient, saleId: string, input: EditSaleInput) {
  return prisma.$transaction(async (tx) => {
    const saleRouteId = await resolveSaleRoute(tx, input.saleRouteId, input.newSaleRouteName);
    const sale = await tx.sale.findUniqueOrThrow({
      where: { id: saleId },
      include: { allocations: true },
    });

    const oldShipmentIds = new Set(sale.allocations.map((a) => a.shipmentId));

    // Locks every arrived batch for the product (a superset of both the
    // old and any possible new allocation set) before mutating anything.
    const locked = await lockArrivedShipmentsForProduct(tx, sale.productId);

    await tx.saleAllocation.deleteMany({ where: { saleId } });

    const remaining = await getRemainingQty(tx, locked.map((s) => s.id));
    const selection = selectFifoBatches(toFifoCandidates(locked, remaining), input.quantity);
    if (!selection.ok) {
      throw new InsufficientStockError(selection.insufficientBy);
    }

    for (const plan of selection.allocations) {
      await tx.saleAllocation.create({
        data: {
          saleId,
          shipmentId: plan.shipmentId,
          quantity: plan.quantity,
          // Placeholder — repackShipmentAllocations below recomputes
          // every allocation's real start/cost from scratch.
          unitStartIndex: 0,
          costBasisCents: 0,
        },
      });
    }

    await tx.sale.update({
      where: { id: saleId },
      data: {
        quantity: input.quantity,
        pricePerUnit: input.pricePerUnit,
        saleRouteId,
      },
    });

    const newShipmentIds = new Set(selection.allocations.map((a) => a.shipmentId));
    const touchedIds = new Set([...oldShipmentIds, ...newShipmentIds]);
    const byId = new Map(locked.map((s) => [s.id, s]));
    for (const shipmentId of touchedIds) {
      await repackShipmentAllocations(tx, byId.get(shipmentId)!);
    }

    return tx.sale.findUniqueOrThrow({
      where: { id: saleId },
      include: { allocations: true },
    });
  });
}

/**
 * Deletes a sale (cascades its allocations) and repacks every batch it
 * touched so the gap it leaves closes correctly.
 */
export async function deleteSale(prisma: PrismaClient, saleId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUniqueOrThrow({
      where: { id: saleId },
      include: { allocations: true },
    });
    const shipmentIds = [...new Set(sale.allocations.map((a) => a.shipmentId))];

    const locked = await lockShipments(tx, shipmentIds);

    await tx.sale.delete({ where: { id: saleId } });

    for (const shipment of locked) {
      await repackShipmentAllocations(tx, shipment);
    }
  });
}

/** Profit in cents: revenue (price/unit × qty) minus the summed FIFO cost basis of its allocations. */
export function saleProfitCents(sale: {
  pricePerUnit: Prisma.Decimal | string | number;
  quantity: number;
  allocations: { costBasisCents: number }[];
}): number {
  const revenueCents = decimalToCents(sale.pricePerUnit) * sale.quantity;
  const costCents = sale.allocations.reduce((sum, a) => sum + a.costBasisCents, 0);
  return revenueCents - costCents;
}
