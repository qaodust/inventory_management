import { describe, expect, it } from "vitest";
import { testPrisma } from "../db";
import { createAdjustment } from "@/lib/inventory-adjustments";
import { AdjustmentReason } from "@/generated/prisma/client";
import { computeSellThroughDate } from "@/lib/metrics";
import { createSale } from "@/lib/sales";
import { createBaseFixtures, createShipment } from "./factories";

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
