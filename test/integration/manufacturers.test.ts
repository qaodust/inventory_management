import { describe, expect, it } from "vitest";
import { testPrisma } from "../db";
import {
  computeReliability,
  createManufacturer,
  DuplicateManufacturerNameError,
  editManufacturer,
  InvalidRatingError,
  MIN_SHIPMENTS_FOR_RELIABILITY,
} from "@/lib/manufacturers";
import { createBaseFixtures, createShipment } from "./factories";

describe("createManufacturer", () => {
  it("creates a manufacturer with ratings and notes", async () => {
    const manufacturer = await createManufacturer(testPrisma, {
      name: "Acme Co",
      qualityRating: 4,
      qualityNote: "Solid stitching",
      easeOfUseRating: 3,
      easeOfUseNote: "Slow to respond to email",
    });

    expect(manufacturer.name).toBe("Acme Co");
    expect(manufacturer.qualityRating).toBe(4);
    expect(manufacturer.qualityNote).toBe("Solid stitching");
    expect(manufacturer.easeOfUseRating).toBe(3);
    expect(manufacturer.easeOfUseNote).toBe("Slow to respond to email");
  });

  it("creates a manufacturer with no ratings yet", async () => {
    const manufacturer = await createManufacturer(testPrisma, { name: "New Supplier" });
    expect(manufacturer.qualityRating).toBeNull();
    expect(manufacturer.easeOfUseRating).toBeNull();
  });

  it("trims the name and stores blank notes as null", async () => {
    const manufacturer = await createManufacturer(testPrisma, {
      name: "  Padded Name  ",
      qualityNote: "   ",
    });
    expect(manufacturer.name).toBe("Padded Name");
    expect(manufacturer.qualityNote).toBeNull();
  });

  it("rejects a blank name", async () => {
    await expect(createManufacturer(testPrisma, { name: "   " })).rejects.toThrow(
      "Manufacturer name is required."
    );
  });

  it("rejects an out-of-range quality rating", async () => {
    await expect(
      createManufacturer(testPrisma, { name: "Bad Rating Co", qualityRating: 6 })
    ).rejects.toThrow(InvalidRatingError);
  });

  it("rejects a non-integer ease-of-use rating", async () => {
    await expect(
      createManufacturer(testPrisma, { name: "Fractional Co", easeOfUseRating: 2.5 })
    ).rejects.toThrow(InvalidRatingError);
  });

  it("rejects a duplicate name", async () => {
    await createManufacturer(testPrisma, { name: "Only One Co" });
    await expect(createManufacturer(testPrisma, { name: "Only One Co" })).rejects.toThrow(
      DuplicateManufacturerNameError
    );
  });
});

describe("editManufacturer", () => {
  it("updates ratings and notes independently of name", async () => {
    const manufacturer = await createManufacturer(testPrisma, { name: "Editable Co" });

    const updated = await editManufacturer(testPrisma, manufacturer.id, {
      qualityRating: 5,
      qualityNote: "Excellent this time",
    });

    expect(updated.name).toBe("Editable Co");
    expect(updated.qualityRating).toBe(5);
    expect(updated.qualityNote).toBe("Excellent this time");
    expect(updated.easeOfUseRating).toBeNull();
  });

  it("overwrites (does not accumulate) an existing rating note", async () => {
    const manufacturer = await createManufacturer(testPrisma, {
      name: "Overwrite Co",
      qualityRating: 2,
      qualityNote: "Rough first batch",
    });

    const updated = await editManufacturer(testPrisma, manufacturer.id, {
      qualityRating: 4,
      qualityNote: "Much better second batch",
    });

    expect(updated.qualityRating).toBe(4);
    expect(updated.qualityNote).toBe("Much better second batch");
  });

  it("renames a manufacturer", async () => {
    const manufacturer = await createManufacturer(testPrisma, { name: "Old Name Co" });
    const updated = await editManufacturer(testPrisma, manufacturer.id, { name: "New Name Co" });
    expect(updated.name).toBe("New Name Co");
  });

  it("rejects renaming to another manufacturer's name", async () => {
    await createManufacturer(testPrisma, { name: "Taken Co" });
    const manufacturer = await createManufacturer(testPrisma, { name: "Renamable Co" });

    await expect(
      editManufacturer(testPrisma, manufacturer.id, { name: "Taken Co" })
    ).rejects.toThrow(DuplicateManufacturerNameError);
  });

  it("rejects an out-of-range rating on edit", async () => {
    const manufacturer = await createManufacturer(testPrisma, { name: "Range Check Co" });
    await expect(
      editManufacturer(testPrisma, manufacturer.id, { easeOfUseRating: 0 })
    ).rejects.toThrow(InvalidRatingError);
  });
});

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
