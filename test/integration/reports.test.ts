import { describe, expect, it } from "vitest";
import { testPrisma } from "../db";
import {
  computeOverviewReport,
  computeProductReport,
  computeManufacturerReport,
  computeRouteReport,
} from "@/lib/reports";
import { createSale } from "@/lib/sales";
import { createBaseFixtures, createManufacturer, createShipment } from "./factories";

const RANGE_FEB = {
  from: new Date("2026-02-01T00:00:00.000Z"),
  to: new Date("2026-02-28T00:00:00.000Z"),
};

/** Directly inserts a historical sale + allocation, bypassing createSale's server-set "today" saleDate. */
async function createHistoricalSale(opts: {
  productId: string;
  saleRouteId: string;
  loggedByUserId: string;
  shipmentId: string;
  quantity: number;
  pricePerUnit: string;
  saleDate: string;
  costBasisCents: number;
}) {
  const sale = await testPrisma.sale.create({
    data: {
      productId: opts.productId,
      quantity: opts.quantity,
      pricePerUnit: opts.pricePerUnit,
      saleRouteId: opts.saleRouteId,
      saleDate: new Date(`${opts.saleDate}T00:00:00.000Z`),
      loggedByUserId: opts.loggedByUserId,
    },
  });
  await testPrisma.saleAllocation.create({
    data: {
      saleId: sale.id,
      shipmentId: opts.shipmentId,
      quantity: opts.quantity,
      unitStartIndex: 0,
      costBasisCents: opts.costBasisCents,
    },
  });
  return sale;
}

describe("computeOverviewReport", () => {
  it("computes avg sell-through days only from batches that sold through within the range", async () => {
    const { user, manufacturer, product, saleRoute } = await createBaseFixtures();
    // Arrives Feb 1, sells through Feb 5 (in range) — 4 days.
    const inRangeShipment = await createShipment({
      manufacturerId: manufacturer.id,
      productId: product.id,
      loggedByUserId: user.id,
      quantityOrdered: 5,
      productCost: "25.00",
      shippingFee: "0.00",
      orderDate: "2026-01-25",
      arrivalDate: "2026-02-01",
    });
    await createHistoricalSale({
      productId: product.id,
      saleRouteId: saleRoute.id,
      loggedByUserId: user.id,
      shipmentId: inRangeShipment.id,
      quantity: 5,
      pricePerUnit: "10.00",
      saleDate: "2026-02-05",
      costBasisCents: 2500,
    });

    // Sells through in January — must be excluded.
    const outOfRangeShipment = await createShipment({
      manufacturerId: manufacturer.id,
      productId: product.id,
      loggedByUserId: user.id,
      quantityOrdered: 5,
      productCost: "25.00",
      shippingFee: "0.00",
      orderDate: "2026-01-01",
      arrivalDate: "2026-01-02",
    });
    await createHistoricalSale({
      productId: product.id,
      saleRouteId: saleRoute.id,
      loggedByUserId: user.id,
      shipmentId: outOfRangeShipment.id,
      quantity: 5,
      pricePerUnit: "10.00",
      saleDate: "2026-01-10",
      costBasisCents: 2500,
    });

    const report = await computeOverviewReport(testPrisma, RANGE_FEB);
    expect(report.avgSellThroughDays).toBe(4);
  });

  it("returns null avg sell-through days when nothing sold through in range", async () => {
    await createBaseFixtures();
    const report = await computeOverviewReport(testPrisma, RANGE_FEB);
    expect(report.avgSellThroughDays).toBeNull();
  });
});

describe("computeProductReport", () => {
  it("rolls up profit and units sold per product, including only products active in range", async () => {
    const { user, manufacturer, saleRoute } = await createBaseFixtures();
    const productA = await testPrisma.product.create({ data: { name: "Product A" } });
    const productB = await testPrisma.product.create({ data: { name: "Product B" } });

    const shipmentA = await createShipment({
      manufacturerId: manufacturer.id,
      productId: productA.id,
      loggedByUserId: user.id,
      quantityOrdered: 10,
      productCost: "50.00",
      shippingFee: "0.00",
      orderDate: "2026-01-01",
      arrivalDate: "2026-01-02",
    });
    await createHistoricalSale({
      productId: productA.id,
      saleRouteId: saleRoute.id,
      loggedByUserId: user.id,
      shipmentId: shipmentA.id,
      quantity: 4,
      pricePerUnit: "20.00",
      saleDate: "2026-02-10",
      costBasisCents: 2000, // 4 units @ $5/unit
    });

    // Product B sold outside the range — must not appear in the report.
    const shipmentB = await createShipment({
      manufacturerId: manufacturer.id,
      productId: productB.id,
      loggedByUserId: user.id,
      quantityOrdered: 10,
      productCost: "50.00",
      shippingFee: "0.00",
      orderDate: "2026-01-01",
      arrivalDate: "2026-01-02",
    });
    await createHistoricalSale({
      productId: productB.id,
      saleRouteId: saleRoute.id,
      loggedByUserId: user.id,
      shipmentId: shipmentB.id,
      quantity: 2,
      pricePerUnit: "20.00",
      saleDate: "2026-01-15",
      costBasisCents: 1000,
    });

    const rows = await computeProductReport(testPrisma, RANGE_FEB);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      productId: productA.id,
      unitsSold: 4,
      profitCents: 8000 - 2000, // (4 * $20) - $20 cost basis
    });
  });
});

describe("computeManufacturerReport", () => {
  it("attributes profit per allocation to the shipment's manufacturer, scoped by saleDate", async () => {
    const { user, product, saleRoute } = await createBaseFixtures();
    const mfgA = await createManufacturer();
    const mfgB = await createManufacturer();

    const shipmentA = await createShipment({
      manufacturerId: mfgA.id,
      productId: product.id,
      loggedByUserId: user.id,
      quantityOrdered: 5,
      productCost: "25.00",
      shippingFee: "5.00",
      orderDate: "2026-02-01",
      arrivalDate: "2026-02-02",
    });
    const shipmentB = await createShipment({
      manufacturerId: mfgB.id,
      productId: product.id,
      loggedByUserId: user.id,
      quantityOrdered: 5,
      productCost: "25.00",
      shippingFee: "5.00",
      orderDate: "2026-02-01",
      arrivalDate: "2026-02-02",
    });

    await createHistoricalSale({
      productId: product.id,
      saleRouteId: saleRoute.id,
      loggedByUserId: user.id,
      shipmentId: shipmentA.id,
      quantity: 3,
      pricePerUnit: "10.00",
      saleDate: "2026-02-10",
      costBasisCents: 1500, // 3 units @ $5/unit
    });
    await createHistoricalSale({
      productId: product.id,
      saleRouteId: saleRoute.id,
      loggedByUserId: user.id,
      shipmentId: shipmentB.id,
      quantity: 2,
      pricePerUnit: "10.00",
      saleDate: "2026-02-11",
      costBasisCents: 1000, // 2 units @ $5/unit
    });

    const rows = await computeManufacturerReport(testPrisma, RANGE_FEB);
    const rowA = rows.find((r) => r.manufacturerId === mfgA.id)!;
    const rowB = rows.find((r) => r.manufacturerId === mfgB.id)!;
    expect(rowA.profitCents).toBe(3000 - 1500); // 3 * $10 - $15 cost
    expect(rowB.profitCents).toBe(2000 - 1000); // 2 * $10 - $10 cost
  });

  it("scopes avg delivery days and shipping fee by orderDate, and reports insufficient-data reliability under the threshold", async () => {
    const { user, product } = await createBaseFixtures();
    const mfg = await createManufacturer();

    // Inside range: ordered Feb 1, arrived Feb 3 (2 days), $10 shipping.
    await createShipment({
      manufacturerId: mfg.id,
      productId: product.id,
      loggedByUserId: user.id,
      quantityOrdered: 5,
      productCost: "25.00",
      shippingFee: "10.00",
      orderDate: "2026-02-01",
      arrivalDate: "2026-02-03",
      expectedArrivalDate: "2026-02-05",
    });
    // Outside range: ordered in January — must not affect avgDeliveryDays/avgShippingFeeCents.
    await createShipment({
      manufacturerId: mfg.id,
      productId: product.id,
      loggedByUserId: user.id,
      quantityOrdered: 5,
      productCost: "25.00",
      shippingFee: "1000.00",
      orderDate: "2026-01-01",
      arrivalDate: "2026-01-10",
      expectedArrivalDate: "2026-01-05",
    });

    const rows = await computeManufacturerReport(testPrisma, RANGE_FEB);
    const row = rows.find((r) => r.manufacturerId === mfg.id)!;
    expect(row.avgDeliveryDays).toBe(2);
    expect(row.avgShippingFeeCents).toBe(1000);
    expect(row.reliability).toEqual({ status: "insufficient-data", sampleSize: 1 });
  });

  it("never date-scopes manufacturer ratings", async () => {
    const mfg = await testPrisma.manufacturer.create({
      data: { name: "Rated Co", qualityRating: 4, easeOfUseRating: 5 },
    });

    const rows = await computeManufacturerReport(testPrisma, RANGE_FEB);
    const row = rows.find((r) => r.manufacturerId === mfg.id)!;
    expect(row.qualityRating).toBe(4);
    expect(row.easeOfUseRating).toBe(5);
  });
});

describe("computeRouteReport", () => {
  it("rolls up units sold and profit per route within range, excluding routes with no sales in range", async () => {
    const { user, manufacturer, product } = await createBaseFixtures();
    const routeA = await testPrisma.saleRoute.create({ data: { name: "Route A" } });
    const routeB = await testPrisma.saleRoute.create({ data: { name: "Route B" } });

    const shipment = await createShipment({
      manufacturerId: manufacturer.id,
      productId: product.id,
      loggedByUserId: user.id,
      quantityOrdered: 10,
      productCost: "50.00",
      shippingFee: "0.00",
      orderDate: "2026-01-01",
      arrivalDate: "2026-01-02",
    });

    await createHistoricalSale({
      productId: product.id,
      saleRouteId: routeA.id,
      loggedByUserId: user.id,
      shipmentId: shipment.id,
      quantity: 4,
      pricePerUnit: "15.00",
      saleDate: "2026-02-10",
      costBasisCents: 2000, // 4 units @ $5/unit
    });
    // Route B sold outside the range.
    await createHistoricalSale({
      productId: product.id,
      saleRouteId: routeB.id,
      loggedByUserId: user.id,
      shipmentId: shipment.id,
      quantity: 2,
      pricePerUnit: "15.00",
      saleDate: "2026-01-15",
      costBasisCents: 1000,
    });

    const rows = await computeRouteReport(testPrisma, RANGE_FEB);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      routeId: routeA.id,
      unitsSold: 4,
      totalProfitCents: 6000 - 2000, // (4 * $15) - $20 cost basis
      avgProfitPerUnitCents: Math.round((6000 - 2000) / 4),
    });
  });
});
