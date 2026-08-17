import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { decimalToCents } from "./money";

/**
 * Remaining quantity per shipment = quantityOrdered + SUM(adjustment
 * deltas) - SUM(allocation quantities). Read-only variant of
 * locking.ts's getRemainingQty (no FOR UPDATE) — safe outside a
 * transaction, for display-only aggregates like this module's.
 */
export async function readRemainingQty(
  prisma: PrismaClient,
  shipmentIds: string[]
): Promise<Map<string, number>> {
  if (shipmentIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<{ id: string; remaining: number }[]>`
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

/**
 * The date a batch fully sold out — i.e. the sale date of the
 * chronologically-last sale allocation drawn against it, once sale
 * allocations alone (ignoring inventory adjustments) have consumed the
 * batch's entire original quantityOrdered. Returns null if sales alone
 * haven't consumed the batch yet. Deliberately ignores adjustments when
 * deciding *whether* the batch sold through: a damage/loss adjustment
 * that zeroes out remaining stock is not the same as the batch's units
 * being sold, so it must not be reported as a sell-through date.
 */
export async function computeSellThroughDate(
  prisma: PrismaClient,
  shipmentId: string
): Promise<Date | null> {
  const shipment = await prisma.shipment.findUniqueOrThrow({
    where: { id: shipmentId },
    select: { quantityOrdered: true },
  });

  const allocationSum = await prisma.saleAllocation.aggregate({
    where: { shipmentId },
    _sum: { quantity: true },
  });

  const remainingViaSalesOnly =
    shipment.quantityOrdered - (allocationSum._sum.quantity ?? 0);

  if (remainingViaSalesOnly > 0) return null;

  const lastAllocation = await prisma.saleAllocation.findFirst({
    where: { shipmentId },
    orderBy: { sequence: "desc" },
    include: { sale: { select: { saleDate: true } } },
  });

  return lastAllocation?.sale.saleDate ?? null;
}

/**
 * Sum of remaining quantity across each product's arrived batches
 * (shipments with an arrivalDate) — a pending, not-yet-arrived order
 * isn't in-hand stock yet, so it's excluded. Keyed by productId.
 */
export async function getQuantitiesAvailable(
  prisma: PrismaClient,
  productIds: string[]
): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<{ productId: string; remaining: number }[]>`
    SELECT
      s."productId" AS "productId",
      SUM(
        s."quantityOrdered"
        + COALESCE((SELECT SUM(a."quantityDelta") FROM "InventoryAdjustment" a WHERE a."shipmentId" = s.id), 0)
        - COALESCE((SELECT SUM(sa.quantity) FROM "SaleAllocation" sa WHERE sa."shipmentId" = s.id), 0)
      )::int AS remaining
    FROM "Shipment" s
    WHERE s."productId" IN (${Prisma.join(productIds)}) AND s."arrivalDate" IS NOT NULL
    GROUP BY s."productId"
  `;
  return new Map(rows.map((r) => [r.productId, Number(r.remaining)]));
}

export interface ProductBatch {
  id: string;
  arrivalDate: Date;
  manufacturerName: string;
  quantityOrdered: number;
  remainingQty: number;
  costPerUnitCents: number;
  sellThroughDate: Date | null;
}

/** A product's arrived batches (shipments), oldest-arrived-first — matches the FIFO consumption order. */
export async function getProductBatches(
  prisma: PrismaClient,
  productId: string
): Promise<ProductBatch[]> {
  const shipments = await prisma.shipment.findMany({
    where: { productId, arrivalDate: { not: null } },
    orderBy: [{ arrivalDate: "asc" }, { id: "asc" }],
    include: { manufacturer: { select: { name: true } } },
  });
  if (shipments.length === 0) return [];

  const remainingMap = await readRemainingQty(
    prisma,
    shipments.map((s) => s.id)
  );

  return Promise.all(
    shipments.map(async (s) => {
      const totalCents = decimalToCents(s.productCost) + decimalToCents(s.shippingFee);
      return {
        id: s.id,
        arrivalDate: s.arrivalDate!,
        manufacturerName: s.manufacturer.name,
        quantityOrdered: s.quantityOrdered,
        remainingQty: remainingMap.get(s.id) ?? 0,
        costPerUnitCents: Math.round(totalCents / s.quantityOrdered),
        sellThroughDate: await computeSellThroughDate(prisma, s.id),
      };
    })
  );
}

export interface DashboardStats {
  totalProfitCents: number;
  totalRevenueCents: number;
  unitsSold: number;
  activeBatches: number;
}

/**
 * Dashboard summary stats. `range` scopes sales by saleDate and batches
 * by arrivalDate (design.md: the date-range filter applies to all four
 * stat cards); null means all-time, the Dashboard's default.
 */
export async function computeDashboardStats(
  prisma: PrismaClient,
  range: { from: Date; to: Date } | null
): Promise<DashboardStats> {
  const dateFilter = range ? { gte: range.from, lte: range.to } : undefined;

  const sales = await prisma.sale.findMany({
    where: dateFilter ? { saleDate: dateFilter } : undefined,
    select: {
      pricePerUnit: true,
      quantity: true,
      allocations: { select: { costBasisCents: true } },
    },
  });

  let totalRevenueCents = 0;
  let totalCostCents = 0;
  let unitsSold = 0;
  for (const sale of sales) {
    totalRevenueCents += decimalToCents(sale.pricePerUnit) * sale.quantity;
    totalCostCents += sale.allocations.reduce((sum, a) => sum + a.costBasisCents, 0);
    unitsSold += sale.quantity;
  }

  const shipments = await prisma.shipment.findMany({
    where: { arrivalDate: dateFilter ?? { not: null } },
    select: { id: true },
  });
  const remainingMap = await readRemainingQty(
    prisma,
    shipments.map((s) => s.id)
  );
  const activeBatches = shipments.filter((s) => (remainingMap.get(s.id) ?? 0) > 0).length;

  return {
    totalProfitCents: totalRevenueCents - totalCostCents,
    totalRevenueCents,
    unitsSold,
    activeBatches,
  };
}

export interface ManufacturerStats {
  totalShipments: number;
  /** Average calendar days from orderDate to arrivalDate, over arrived shipments only. Null if none have arrived yet. */
  avgDeliveryDays: number | null;
  /** Average shipping fee in cents, over all shipments (fee is known at order time regardless of arrival). Null if there are no shipments at all. */
  avgShippingFeeCents: number | null;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Manufacturer-level stats aggregated from its Shipment records — never stored directly on the manufacturer. */
export async function computeManufacturerStats(
  prisma: PrismaClient,
  manufacturerId: string
): Promise<ManufacturerStats> {
  const shipments = await prisma.shipment.findMany({
    where: { manufacturerId },
    select: { orderDate: true, arrivalDate: true, shippingFee: true },
  });

  const totalShipments = shipments.length;
  if (totalShipments === 0) {
    return { totalShipments: 0, avgDeliveryDays: null, avgShippingFeeCents: null };
  }

  const arrived = shipments.filter((s) => s.arrivalDate !== null);
  const avgDeliveryDays =
    arrived.length === 0
      ? null
      : arrived.reduce(
          (sum, s) => sum + (s.arrivalDate!.getTime() - s.orderDate.getTime()) / MS_PER_DAY,
          0
        ) / arrived.length;

  const avgShippingFeeCents = Math.round(
    shipments.reduce((sum, s) => sum + decimalToCents(s.shippingFee), 0) / totalShipments
  );

  return { totalShipments, avgDeliveryDays, avgShippingFeeCents };
}
