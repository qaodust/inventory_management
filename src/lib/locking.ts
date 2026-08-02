import { Prisma } from "@/generated/prisma/client";

export interface LockedShipmentRow {
  id: string;
  arrivalDate: Date;
  quantityOrdered: number;
  /** Decimal(12,2) columns come back from the raw pg driver as strings — pass straight into decimalToCents(). */
  productCost: string;
  shippingFee: string;
}

const LOCKED_SHIPMENT_COLUMNS = `id, "arrivalDate", "quantityOrdered", "productCost", "shippingFee"`;

/**
 * Locks (SELECT ... FOR UPDATE) every arrived batch for a product, in
 * the deterministic (arrivalDate, id) order every write path must use
 * to avoid deadlocks. Must be called before reading or writing any of
 * that product's batches' derived quantities within the same
 * transaction — this is what keeps the later aggregate SUM reads
 * consistent against concurrent writers.
 */
export async function lockArrivedShipmentsForProduct(
  tx: Prisma.TransactionClient,
  productId: string
): Promise<LockedShipmentRow[]> {
  return tx.$queryRaw<LockedShipmentRow[]>`
    SELECT ${Prisma.raw(LOCKED_SHIPMENT_COLUMNS)}
    FROM "Shipment"
    WHERE "productId" = ${productId} AND "arrivalDate" IS NOT NULL
    ORDER BY "arrivalDate" ASC, id ASC
    FOR UPDATE
  `;
}

/** Locks a single batch row. Used by inventory adjustments and shipment edits, which only ever touch one batch. */
export async function lockShipment(
  tx: Prisma.TransactionClient,
  shipmentId: string
): Promise<LockedShipmentRow | undefined> {
  const rows = await tx.$queryRaw<LockedShipmentRow[]>`
    SELECT ${Prisma.raw(LOCKED_SHIPMENT_COLUMNS)}
    FROM "Shipment"
    WHERE id = ${shipmentId}
    FOR UPDATE
  `;
  return rows[0];
}

/**
 * Locks a specific, already-known set of batch rows (e.g. the batches
 * referenced by an existing sale's allocations before a delete/edit),
 * in the same deterministic (arrivalDate, id) order used everywhere
 * else so a smaller lock set never deadlocks against a full-scan lock
 * taken by a concurrent sale-creation transaction on the same product.
 */
export async function lockShipments(
  tx: Prisma.TransactionClient,
  shipmentIds: string[]
): Promise<LockedShipmentRow[]> {
  if (shipmentIds.length === 0) return [];
  return tx.$queryRaw<LockedShipmentRow[]>`
    SELECT ${Prisma.raw(LOCKED_SHIPMENT_COLUMNS)}
    FROM "Shipment"
    WHERE id IN (${Prisma.join(shipmentIds)})
    ORDER BY "arrivalDate" ASC, id ASC
    FOR UPDATE
  `;
}

/**
 * Remaining quantity per shipment = quantityOrdered + SUM(adjustment
 * deltas) - SUM(allocation quantities). Only meaningful when called
 * after the corresponding shipment row(s) are locked in this same
 * transaction.
 */
export async function getRemainingQty(
  tx: Prisma.TransactionClient,
  shipmentIds: string[]
): Promise<Map<string, number>> {
  if (shipmentIds.length === 0) return new Map();
  const rows = await tx.$queryRaw<{ id: string; remaining: number }[]>`
    SELECT
      s.id AS id,
      (
        s."quantityOrdered"
        + COALESCE((SELECT SUM(a."quantityDelta") FROM "InventoryAdjustment" a WHERE a."shipmentId" = s.id), 0)
        - COALESCE((SELECT SUM(sa.quantity) FROM "SaleAllocation" sa WHERE sa."shipmentId" = s.id), 0)
      )::int AS remaining
    FROM "Shipment" s
    WHERE s.id IN (${Prisma.join(shipmentIds)})
  `;
  return new Map(rows.map((r) => [r.id, r.remaining]));
}
