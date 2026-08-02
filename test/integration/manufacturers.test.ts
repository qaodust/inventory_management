import { describe, expect, it } from "vitest";
import { testPrisma } from "../db";
import { computeReliability, MIN_SHIPMENTS_FOR_RELIABILITY } from "@/lib/manufacturers";
import { createBaseFixtures, createShipment } from "./factories";

describe("computeReliability", () => {
  it("reports insufficient-data below the sample-size threshold", async () => {
    const { user, manufacturer, product } = await createBaseFixtures();
    for (let i = 0; i < MIN_SHIPMENTS_FOR_RELIABILITY - 1; i++) {
      await createShipment({
        manufacturerId: manufacturer.id,
        productId: product.id,
        loggedByUserId: user.id,
        quantityOrdered: 1,
        productCost: "1.00",
        shippingFee: "0.00",
        orderDate: "2026-01-01",
        expectedArrivalDate: "2026-01-10",
        arrivalDate: "2026-01-10",
      });
    }

    const result = await computeReliability(testPrisma, manufacturer.id);
    expect(result).toEqual({
      status: "insufficient-data",
      sampleSize: MIN_SHIPMENTS_FOR_RELIABILITY - 1,
    });
  });

  it("computes an on-time percentage once the threshold is met", async () => {
    const { user, manufacturer, product } = await createBaseFixtures();
    // 4 on-time, 1 late = 80%
    const onTimeCount = 4;
    const lateCount = 1;
    for (let i = 0; i < onTimeCount; i++) {
      await createShipment({
        manufacturerId: manufacturer.id,
        productId: product.id,
        loggedByUserId: user.id,
        quantityOrdered: 1,
        productCost: "1.00",
        shippingFee: "0.00",
        orderDate: "2026-01-01",
        expectedArrivalDate: "2026-01-10",
        arrivalDate: "2026-01-10",
      });
    }
    for (let i = 0; i < lateCount; i++) {
      await createShipment({
        manufacturerId: manufacturer.id,
        productId: product.id,
        loggedByUserId: user.id,
        quantityOrdered: 1,
        productCost: "1.00",
        shippingFee: "0.00",
        orderDate: "2026-01-01",
        expectedArrivalDate: "2026-01-10",
        arrivalDate: "2026-01-15",
      });
    }
    expect(onTimeCount + lateCount).toBeGreaterThanOrEqual(MIN_SHIPMENTS_FOR_RELIABILITY);

    const result = await computeReliability(testPrisma, manufacturer.id);
    expect(result).toEqual({
      status: "ok",
      onTimePct: 80,
      sampleSize: 5,
    });
  });

  it("excludes shipments missing arrivalDate or expectedArrivalDate from the sample", async () => {
    const { user, manufacturer, product } = await createBaseFixtures();
    for (let i = 0; i < MIN_SHIPMENTS_FOR_RELIABILITY; i++) {
      await createShipment({
        manufacturerId: manufacturer.id,
        productId: product.id,
        loggedByUserId: user.id,
        quantityOrdered: 1,
        productCost: "1.00",
        shippingFee: "0.00",
        orderDate: "2026-01-01",
        expectedArrivalDate: "2026-01-10",
        arrivalDate: "2026-01-10",
      });
    }
    // Still pending — should not count toward the sample.
    await createShipment({
      manufacturerId: manufacturer.id,
      productId: product.id,
      loggedByUserId: user.id,
      quantityOrdered: 1,
      productCost: "1.00",
      shippingFee: "0.00",
      orderDate: "2026-01-01",
      expectedArrivalDate: "2026-01-20",
      arrivalDate: null,
    });

    const result = await computeReliability(testPrisma, manufacturer.id);
    expect(result.sampleSize).toBe(MIN_SHIPMENTS_FOR_RELIABILITY);
  });
});
