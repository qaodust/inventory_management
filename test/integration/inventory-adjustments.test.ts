import { describe, expect, it } from "vitest";
import { testPrisma } from "../db";
import {
  AdjustmentWouldExceedQuantityError,
  AdjustmentWouldGoNegativeError,
  createAdjustment,
} from "@/lib/inventory-adjustments";
import { AdjustmentReason } from "@/generated/prisma/client";
import { createBaseFixtures, createShipment } from "./factories";

describe("createAdjustment", () => {
  it("records a negative adjustment (e.g. damage) that stays within remaining stock", async () => {
    const { user, manufacturer, product } = await createBaseFixtures();
    const shipment = await createShipment({
      manufacturerId: manufacturer.id,
      productId: product.id,
      loggedByUserId: user.id,
      quantityOrdered: 10,
      productCost: "100.00",
      shippingFee: "0.00",
      orderDate: "2026-01-01",
      arrivalDate: "2026-01-02",
    });

    const adjustment = await createAdjustment(testPrisma, {
      shipmentId: shipment.id,
      quantityDelta: -3,
      reason: AdjustmentReason.DAMAGE,
      effectiveDate: "2026-01-03",
      actingUserId: user.id,
    });

    expect(adjustment.quantityDelta).toBe(-3);
  });

  it("rejects an adjustment that would drive remaining quantity negative", async () => {
    const { user, manufacturer, product } = await createBaseFixtures();
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

    await expect(
      createAdjustment(testPrisma, {
        shipmentId: shipment.id,
        quantityDelta: -6,
        reason: AdjustmentReason.LOSS,
        effectiveDate: "2026-01-03",
        actingUserId: user.id,
      })
    ).rejects.toThrow(AdjustmentWouldGoNegativeError);

    const adjustments = await testPrisma.inventoryAdjustment.findMany();
    expect(adjustments).toHaveLength(0);
  });

  it("rejects a positive adjustment that would push remaining above quantityOrdered", async () => {
    const { user, manufacturer, product } = await createBaseFixtures();
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

    await expect(
      createAdjustment(testPrisma, {
        shipmentId: shipment.id,
        quantityDelta: 2,
        reason: AdjustmentReason.RETURN,
        effectiveDate: "2026-01-03",
        actingUserId: user.id,
      })
    ).rejects.toThrow(AdjustmentWouldExceedQuantityError);

    const adjustments = await testPrisma.inventoryAdjustment.findMany();
    expect(adjustments).toHaveLength(0);
  });

  it("allows a positive adjustment that exactly restores a previously-removed unit", async () => {
    const { user, manufacturer, product } = await createBaseFixtures();
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
    await createAdjustment(testPrisma, {
      shipmentId: shipment.id,
      quantityDelta: -2,
      reason: AdjustmentReason.DAMAGE,
      effectiveDate: "2026-01-02",
      actingUserId: user.id,
    });

    // Remaining is now 3; a +2 return brings it back up to exactly 5
    // (quantityOrdered), which must be allowed.
    const adjustment = await createAdjustment(testPrisma, {
      shipmentId: shipment.id,
      quantityDelta: 2,
      reason: AdjustmentReason.RETURN,
      effectiveDate: "2026-01-03",
      actingUserId: user.id,
    });
    expect(adjustment.quantityDelta).toBe(2);
  });

  it("requires a note when reason is OTHER", async () => {
    const { user, manufacturer, product } = await createBaseFixtures();
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

    await expect(
      createAdjustment(testPrisma, {
        shipmentId: shipment.id,
        quantityDelta: -1,
        reason: AdjustmentReason.OTHER,
        effectiveDate: "2026-01-03",
        actingUserId: user.id,
      })
    ).rejects.toThrow();

    const adjustment = await createAdjustment(testPrisma, {
      shipmentId: shipment.id,
      quantityDelta: -1,
      reason: AdjustmentReason.OTHER,
      note: "explained here",
      effectiveDate: "2026-01-03",
      actingUserId: user.id,
    });
    expect(adjustment.note).toBe("explained here");
  });

  it("rejects a zero quantityDelta", async () => {
    const { user, manufacturer, product } = await createBaseFixtures();
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

    await expect(
      createAdjustment(testPrisma, {
        shipmentId: shipment.id,
        quantityDelta: 0,
        reason: AdjustmentReason.COUNT_CORRECTION,
        effectiveDate: "2026-01-03",
        actingUserId: user.id,
      })
    ).rejects.toThrow();
  });
});
