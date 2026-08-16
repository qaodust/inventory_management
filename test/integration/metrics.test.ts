import { describe, expect, it } from "vitest";
import { testPrisma } from "../db";
import { createAdjustment } from "@/lib/inventory-adjustments";
import { AdjustmentReason } from "@/generated/prisma/client";
import {
  computeSellThroughDate,
  computeManufacturerStats,
  getQuantitiesAvailable,
  getProductBatches,
} from "@/lib/metrics";
import { createSale } from "@/lib/sales";
import { createBaseFixtures, createShipment, createProduct } from "./factories";

describe("computeSellThroughDate", () => {
  it("returns null while sale allocations haven't consumed the full batch", async () => {
    const { user, manufacturer, product, saleRoute } = await createBaseFixtures();
    const shipment = await createShipment({
      manufacturerId: manufacturer.id,
      productId: product.id,
      loggedByUserId: user.id,
      quantityOrdered: 5,
      productCost: "50.00",
      shippingFee: "0.00",
      orderDate: "2026-01-01",
      arrivalDate: "2026-01-02",
    });
    await createSale(testPrisma, {
      productId: product.id,
      quantity: 3,
      pricePerUnit: "10.00",
      saleRouteId: saleRoute.id,
      loggedByUserId: user.id,
    });

    expect(await computeSellThroughDate(testPrisma, shipment.id)).toBeNull();
  });

  it("returns the sale date once sale allocations exactly consume the batch", async () => {
    const { user, manufacturer, product, saleRoute } = await createBaseFixtures();
    const shipment = await createShipment({
      manufacturerId: manufacturer.id,
      productId: product.id,
      loggedByUserId: user.id,
      quantityOrdered: 5,
      productCost: "50.00",
      shippingFee: "0.00",
      orderDate: "2026-01-01",
      arrivalDate: "2026-01-02",
    });
    const sale = await createSale(testPrisma, {
      productId: product.id,
      quantity: 5,
      pricePerUnit: "10.00",
      saleRouteId: saleRoute.id,
      loggedByUserId: user.id,
    });

    const sellThrough = await computeSellThroughDate(testPrisma, shipment.id);
    expect(sellThrough).not.toBeNull();
    expect(sellThrough?.toISOString()).toBe(sale.saleDate.toISOString());
  });

  it("returns null when a damage/loss adjustment (not a sale) is what zeroes out remaining stock", async () => {
    const { user, manufacturer, product, saleRoute } = await createBaseFixtures();
    const shipment = await createShipment({
      manufacturerId: manufacturer.id,
      productId: product.id,
      loggedByUserId: user.id,
      quantityOrdered: 5,
      productCost: "50.00",
      shippingFee: "0.00",
      orderDate: "2026-01-01",
      arrivalDate: "2026-01-02",
    });
    // Sale consumes 3 of 5 — sales alone have not sold through the batch.
    await createSale(testPrisma, {
      productId: product.id,
      quantity: 3,
      pricePerUnit: "10.00",
      saleRouteId: saleRoute.id,
      loggedByUserId: user.id,
    });
    // A damage adjustment removes the remaining 2 units, driving total
    // remaining (sales + adjustments) to zero — but the batch was never
    // actually sold through, so this must still report null.
    await createAdjustment(testPrisma, {
      shipmentId: shipment.id,
      quantityDelta: -2,
      reason: AdjustmentReason.DAMAGE,
      effectiveDate: "2026-01-05",
      actingUserId: user.id,
    });

    expect(await computeSellThroughDate(testPrisma, shipment.id)).toBeNull();
  });
});

describe("computeManufacturerStats", () => {
  it("returns nulls and zero count for a manufacturer with no shipments", async () => {
    const { manufacturer } = await createBaseFixtures();
    expect(await computeManufacturerStats(testPrisma, manufacturer.id)).toEqual({
      totalShipments: 0,
      avgDeliveryDays: null,
      avgShippingFeeCents: null,
    });
  });

  it("averages shipping fee across all shipments but delivery time only across arrived ones", async () => {
    const { user, manufacturer, product } = await createBaseFixtures();
    // Arrived 1 day after order, $10 shipping.
    await createShipment({
      manufacturerId: manufacturer.id,
      productId: product.id,
      loggedByUserId: user.id,
      quantityOrdered: 5,
      productCost: "50.00",
      shippingFee: "10.00",
      orderDate: "2026-01-01",
      arrivalDate: "2026-01-02",
    });
    // Arrived 3 days after order, $20 shipping.
    await createShipment({
      manufacturerId: manufacturer.id,
      productId: product.id,
      loggedByUserId: user.id,
      quantityOrdered: 5,
      productCost: "50.00",
      shippingFee: "20.00",
      orderDate: "2026-01-01",
      arrivalDate: "2026-01-04",
    });
    // Still pending — $30 shipping, no arrival date.
    await createShipment({
      manufacturerId: manufacturer.id,
      productId: product.id,
      loggedByUserId: user.id,
      quantityOrdered: 5,
      productCost: "50.00",
      shippingFee: "30.00",
      orderDate: "2026-01-05",
    });

    const stats = await computeManufacturerStats(testPrisma, manufacturer.id);
    expect(stats.totalShipments).toBe(3);
    expect(stats.avgDeliveryDays).toBe(2); // (1 + 3) / 2
    expect(stats.avgShippingFeeCents).toBe(2000); // (1000 + 2000 + 3000) / 3
  });
});

describe("getQuantitiesAvailable", () => {
  it("sums remaining quantity across a product's arrived batches only, excluding pending ones", async () => {
    const { user, manufacturer, product } = await createBaseFixtures();
    await createShipment({
      manufacturerId: manufacturer.id,
      productId: product.id,
      loggedByUserId: user.id,
      quantityOrdered: 10,
      productCost: "50.00",
      shippingFee: "0.00",
      orderDate: "2026-01-01",
      arrivalDate: "2026-01-02",
    });
    // Pending — must not count toward quantity available.
    await createShipment({
      manufacturerId: manufacturer.id,
      productId: product.id,
      loggedByUserId: user.id,
      quantityOrdered: 100,
      productCost: "50.00",
      shippingFee: "0.00",
      orderDate: "2026-01-05",
    });

    const result = await getQuantitiesAvailable(testPrisma, [product.id]);
    expect(result.get(product.id)).toBe(10);
  });

  it("reflects adjustments and sale allocations in the remaining total", async () => {
    const { user, manufacturer, product, saleRoute } = await createBaseFixtures();
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
    await createSale(testPrisma, {
      productId: product.id,
      quantity: 3,
      pricePerUnit: "10.00",
      saleRouteId: saleRoute.id,
      loggedByUserId: user.id,
    });
    await createAdjustment(testPrisma, {
      shipmentId: shipment.id,
      quantityDelta: -2,
      reason: AdjustmentReason.DAMAGE,
      effectiveDate: "2026-01-05",
      actingUserId: user.id,
    });

    const result = await getQuantitiesAvailable(testPrisma, [product.id]);
    expect(result.get(product.id)).toBe(5); // 10 - 3 (sold) - 2 (damaged)
  });

  it("returns an empty map for an empty productIds list", async () => {
    expect(await getQuantitiesAvailable(testPrisma, [])).toEqual(new Map());
  });
});

describe("getProductBatches", () => {
  it("returns arrived batches oldest-first with remaining qty and cost/unit, excluding pending shipments", async () => {
    const { user, manufacturer, product } = await createBaseFixtures();
    const later = await createShipment({
      manufacturerId: manufacturer.id,
      productId: product.id,
      loggedByUserId: user.id,
      quantityOrdered: 4,
      productCost: "40.00",
      shippingFee: "8.00",
      orderDate: "2026-01-01",
      arrivalDate: "2026-01-10",
    });
    const earlier = await createShipment({
      manufacturerId: manufacturer.id,
      productId: product.id,
      loggedByUserId: user.id,
      quantityOrdered: 5,
      productCost: "50.00",
      shippingFee: "0.00",
      orderDate: "2026-01-01",
      arrivalDate: "2026-01-02",
    });
    // Pending — must be excluded entirely.
    await createShipment({
      manufacturerId: manufacturer.id,
      productId: product.id,
      loggedByUserId: user.id,
      quantityOrdered: 99,
      productCost: "50.00",
      shippingFee: "0.00",
      orderDate: "2026-01-05",
    });

    const batches = await getProductBatches(testPrisma, product.id);

    expect(batches.map((b) => b.id)).toEqual([earlier.id, later.id]);
    expect(batches[0]).toMatchObject({
      quantityOrdered: 5,
      remainingQty: 5,
      costPerUnitCents: 1000, // $50 / 5 units
      manufacturerName: manufacturer.name,
      sellThroughDate: null,
    });
    expect(batches[1]).toMatchObject({
      quantityOrdered: 4,
      remainingQty: 4,
      costPerUnitCents: 1200, // ($40 + $8) / 4 units
    });
  });

  it("returns an empty array for a product with no arrived batches", async () => {
    const product = await createProduct();
    expect(await getProductBatches(testPrisma, product.id)).toEqual([]);
  });
});
