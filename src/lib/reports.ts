import type { PrismaClient } from "@/generated/prisma/client";
import { decimalToCents } from "./money";
import { computeDashboardStats, computeSellThroughDate } from "./metrics";
import { MIN_SHIPMENTS_FOR_RELIABILITY, type ReliabilityResult } from "./manufacturers";

export type ReportRange = { from: Date; to: Date } | null;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function avgDays(durations: number[]): number | null {
  if (durations.length === 0) return null;
  return durations.reduce((sum, d) => sum + d, 0) / durations.length;
}

function inRange(date: Date, range: ReportRange): boolean {
  if (!range) return true;
  return date >= range.from && date <= range.to;
}

interface SoldThroughBatch {
  productId: string;
  arrivalDate: Date;
  sellThroughDate: Date;
}

/**
 * Every arrived batch that has fully sold through, store-wide. Scoped
 * to the report's range by *sell-through date* (when the batch's last
 * unit sold), not arrival date — an "avg sell-through time" stat is
 * about sales that happened in the range, mirroring how the range
 * scopes revenue/profit by saleDate elsewhere in this module.
 */
async function getSoldThroughBatches(prisma: PrismaClient, range: ReportRange): Promise<SoldThroughBatch[]> {
  const shipments = await prisma.shipment.findMany({
    where: { arrivalDate: { not: null } },
    select: { id: true, productId: true, arrivalDate: true },
  });

  const results: SoldThroughBatch[] = [];
  for (const s of shipments) {
    const sellThroughDate = await computeSellThroughDate(prisma, s.id);
    if (sellThroughDate && inRange(sellThroughDate, range)) {
      results.push({ productId: s.productId, arrivalDate: s.arrivalDate!, sellThroughDate });
    }
  }
  return results;
}

export interface OverviewReport {
  totalProfitCents: number;
  totalRevenueCents: number;
  unitsSold: number;
  avgSellThroughDays: number | null;
}

export async function computeOverviewReport(prisma: PrismaClient, range: ReportRange): Promise<OverviewReport> {
  const { totalProfitCents, totalRevenueCents, unitsSold } = await computeDashboardStats(prisma, range);
  const soldThrough = await getSoldThroughBatches(prisma, range);
  const avgSellThroughDays = avgDays(
    soldThrough.map((b) => (b.sellThroughDate.getTime() - b.arrivalDate.getTime()) / MS_PER_DAY)
  );
  return { totalProfitCents, totalRevenueCents, unitsSold, avgSellThroughDays };
}

export interface ProductReportRow {
  productId: string;
  productName: string;
  profitCents: number;
  unitsSold: number;
  avgSellThroughDays: number | null;
}

/** Per-product rollup for the range. Only products with a sale or a sell-through event in range are included. */
export async function computeProductReport(prisma: PrismaClient, range: ReportRange): Promise<ProductReportRow[]> {
  const dateFilter = range ? { gte: range.from, lte: range.to } : undefined;
  const sales = await prisma.sale.findMany({
    where: dateFilter ? { saleDate: dateFilter } : undefined,
    select: {
      productId: true,
      pricePerUnit: true,
      quantity: true,
      allocations: { select: { costBasisCents: true } },
    },
  });

  const byProduct = new Map<string, { profitCents: number; unitsSold: number }>();
  for (const sale of sales) {
    const revenueCents = decimalToCents(sale.pricePerUnit) * sale.quantity;
    const costCents = sale.allocations.reduce((sum, a) => sum + a.costBasisCents, 0);
    const entry = byProduct.get(sale.productId) ?? { profitCents: 0, unitsSold: 0 };
    entry.profitCents += revenueCents - costCents;
    entry.unitsSold += sale.quantity;
    byProduct.set(sale.productId, entry);
  }

  const soldThrough = await getSoldThroughBatches(prisma, range);
  const sellThroughByProduct = new Map<string, number[]>();
  for (const b of soldThrough) {
    const days = (b.sellThroughDate.getTime() - b.arrivalDate.getTime()) / MS_PER_DAY;
    const arr = sellThroughByProduct.get(b.productId) ?? [];
    arr.push(days);
    sellThroughByProduct.set(b.productId, arr);
  }

  const productIds = new Set([...byProduct.keys(), ...sellThroughByProduct.keys()]);
  if (productIds.size === 0) return [];

  const products = await prisma.product.findMany({
    where: { id: { in: [...productIds] } },
    select: { id: true, name: true },
  });

  return products.map((p) => ({
    productId: p.id,
    productName: p.name,
    profitCents: byProduct.get(p.id)?.profitCents ?? 0,
    unitsSold: byProduct.get(p.id)?.unitsSold ?? 0,
    avgSellThroughDays: avgDays(sellThroughByProduct.get(p.id) ?? []),
  }));
}

export interface ManufacturerReportRow {
  manufacturerId: string;
  manufacturerName: string;
  profitCents: number;
  avgDeliveryDays: number | null;
  avgShippingFeeCents: number | null;
  qualityRating: number | null;
  easeOfUseRating: number | null;
  reliability: ReliabilityResult;
}

/**
 * Per-manufacturer rollup for the range. Profit is attributed per sale
 * allocation (that allocation's share of its sale's revenue, at the
 * sale's uniform price/unit, minus its own cost basis) and scoped by
 * saleDate. Delivery time, shipping fee, and reliability are scoped by
 * orderDate instead — they describe shipment events, not sale events.
 * Ratings are a manufacturer-level property, not an event, so they are
 * never date-scoped (same exemption as the Dashboard's Pending
 * Deliveries, which is always "current").
 */
export async function computeManufacturerReport(
  prisma: PrismaClient,
  range: ReportRange
): Promise<ManufacturerReportRow[]> {
  const dateFilter = range ? { gte: range.from, lte: range.to } : undefined;

  const allocations = await prisma.saleAllocation.findMany({
    where: dateFilter ? { sale: { saleDate: dateFilter } } : undefined,
    select: {
      quantity: true,
      costBasisCents: true,
      sale: { select: { pricePerUnit: true } },
      shipment: { select: { manufacturerId: true } },
    },
  });
  const profitByManufacturer = new Map<string, number>();
  for (const a of allocations) {
    const revenueCents = decimalToCents(a.sale.pricePerUnit) * a.quantity;
    const profitCents = revenueCents - a.costBasisCents;
    profitByManufacturer.set(
      a.shipment.manufacturerId,
      (profitByManufacturer.get(a.shipment.manufacturerId) ?? 0) + profitCents
    );
  }

  const manufacturers = await prisma.manufacturer.findMany({ orderBy: { name: "asc" } });

  return Promise.all(
    manufacturers.map(async (m) => {
      const shipments = await prisma.shipment.findMany({
        where: { manufacturerId: m.id, orderDate: dateFilter },
        select: { orderDate: true, arrivalDate: true, expectedArrivalDate: true, shippingFee: true },
      });

      const arrived = shipments.filter((s) => s.arrivalDate !== null);
      const avgDeliveryDays = avgDays(
        arrived.map((s) => (s.arrivalDate!.getTime() - s.orderDate.getTime()) / MS_PER_DAY)
      );
      const avgShippingFeeCents =
        shipments.length === 0
          ? null
          : Math.round(shipments.reduce((sum, s) => sum + decimalToCents(s.shippingFee), 0) / shipments.length);

      const reliabilityEligible = shipments.filter(
        (s) => s.arrivalDate !== null && s.expectedArrivalDate !== null
      );
      const reliability: ReliabilityResult =
        reliabilityEligible.length < MIN_SHIPMENTS_FOR_RELIABILITY
          ? { status: "insufficient-data", sampleSize: reliabilityEligible.length }
          : {
              status: "ok",
              sampleSize: reliabilityEligible.length,
              onTimePct:
                (reliabilityEligible.filter((s) => s.arrivalDate! <= s.expectedArrivalDate!).length /
                  reliabilityEligible.length) *
                100,
            };

      return {
        manufacturerId: m.id,
        manufacturerName: m.name,
        profitCents: profitByManufacturer.get(m.id) ?? 0,
        avgDeliveryDays,
        avgShippingFeeCents,
        qualityRating: m.qualityRating,
        easeOfUseRating: m.easeOfUseRating,
        reliability,
      };
    })
  );
}

export interface RouteReportRow {
  routeId: string;
  routeName: string;
  unitsSold: number;
  avgProfitPerUnitCents: number;
  totalProfitCents: number;
}

/** Per-route rollup for the range, scoped by saleDate. Only routes with a sale in range are included. */
export async function computeRouteReport(prisma: PrismaClient, range: ReportRange): Promise<RouteReportRow[]> {
  const dateFilter = range ? { gte: range.from, lte: range.to } : undefined;
  const sales = await prisma.sale.findMany({
    where: dateFilter ? { saleDate: dateFilter } : undefined,
    select: {
      saleRouteId: true,
      pricePerUnit: true,
      quantity: true,
      saleRoute: { select: { name: true } },
      allocations: { select: { costBasisCents: true } },
    },
  });

  const byRoute = new Map<string, { routeName: string; unitsSold: number; profitCents: number }>();
  for (const sale of sales) {
    const revenueCents = decimalToCents(sale.pricePerUnit) * sale.quantity;
    const costCents = sale.allocations.reduce((sum, a) => sum + a.costBasisCents, 0);
    const entry = byRoute.get(sale.saleRouteId) ?? { routeName: sale.saleRoute.name, unitsSold: 0, profitCents: 0 };
    entry.unitsSold += sale.quantity;
    entry.profitCents += revenueCents - costCents;
    byRoute.set(sale.saleRouteId, entry);
  }

  return [...byRoute.entries()].map(([routeId, v]) => ({
    routeId,
    routeName: v.routeName,
    unitsSold: v.unitsSold,
    avgProfitPerUnitCents: v.unitsSold === 0 ? 0 : Math.round(v.profitCents / v.unitsSold),
    totalProfitCents: v.profitCents,
  }));
}

/** Sorts rows by a numeric accessor (nulls sort last), for the Reports tables' sortable columns. */
export function sortReportRows<T>(rows: T[], accessor: (row: T) => number | null, dir: "asc" | "desc"): T[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = accessor(a);
    const bv = accessor(b);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return (av - bv) * sign;
  });
}
