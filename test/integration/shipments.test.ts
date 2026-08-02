import { describe, expect, it } from "vitest";
import { testPrisma } from "../db";
import { createAdjustment } from "@/lib/inventory-adjustments";
import { AdjustmentReason } from "@/generated/prisma/client";
import { createSale } from "@/lib/sales";
import { editShipment, ShipmentIdentityLockedError, ShipmentQuantityReductionError } from "@/lib/shipments";
import { createBaseFixtures, createProduct, createShipment } from "./factories";

describe("editShipment", () => {
  it("repacks every existing allocation when productCost changes", async () => {
    const { user, manufacturer, product, saleRoute } = await createBaseFixtures();
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
    const sale = await createSale(testPrisma, {
      productId: product.id,
      quantity: 4,
      pricePerUnit: "25.00",
      saleRouteId: saleRoute.id,
      loggedByUserId: user.id,
    });
    expect(sale.allocations[0].costBasisCents).toBe(4000); // 4 * (10000/10)

    await editShipment(testPrisma, shipment.id, { productCost: "200.00" });

    const alloc = await testPrisma.saleAllocation.findFirstOrThrow({
      where: { shipmentId: shipment.id },
    });
    // Total cost doubled to 20000 cents / 10 units = 2000/unit -> 4 * 2000 = 8000
    expect(alloc.costBasisCents).toBe(8000);
    expect(alloc.unitStartIndex).toBe(0);
  });

  it("rejects a quantityOrdered reduction that would drive remaining stock negative", async () => {
    const { user, manufacturer, product, saleRoute } = await createBaseFixtures();
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
    await createSale(testPrisma, {
      productId: product.id,
      quantity: 8,
      pricePerUnit: "25.00",
      saleRouteId: saleRoute.id,
      loggedByUserId: user.id,
    });

    // 8 units already sold, only 2 remaining — reducing to 5 would leave
    // -3 (5 - 8), which must be rejected.
    await expect(
      editShipment(testPrisma, shipment.id, { quantityOrdered: 5 })
    ).rejects.toThrow(ShipmentQuantityReductionError);

    const unchanged = await testPrisma.shipment.findUniqueOrThrow({ where: { id: shipment.id } });
    expect(unchanged.quantityOrdered).toBe(10);
  });

  it("allows a quantityOrdered reduction that still covers everything already sold", async () => {
    const { user, manufacturer, product, saleRoute } = await createBaseFixtures();
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
    await createSale(testPrisma, {
      productId: product.id,
      quantity: 4,
      pricePerUnit: "25.00",
      saleRouteId: saleRoute.id,
      loggedByUserId: user.id,
    });

    const updated = await editShipment(testPrisma, shipment.id, { quantityOrdered: 6 });
    expect(updated.quantityOrdered).toBe(6);

    // Repack triggered by the quantity change: 4 units allocated out of 6
    // now, cost basis recalculated against the new quantity.
    const alloc = await testPrisma.saleAllocation.findFirstOrThrow({
      where: { shipmentId: shipment.id },
    });
    // 10000 cents / 6 units = 1666 base, remainder 4 -> first 4 units get 1667
    expect(alloc.costBasisCents).toBe(1667 * 4);
  });

  it("rejects changing productId once the batch has a sale allocation", async () => {
    const { user, manufacturer, product, saleRoute } = await createBaseFixtures();
    const otherProduct = await createProduct();
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
    await createSale(testPrisma, {
      productId: product.id,
      quantity: 2,
      pricePerUnit: "25.00",
      saleRouteId: saleRoute.id,
      loggedByUserId: user.id,
    });

    await expect(
      editShipment(testPrisma, shipment.id, { productId: otherProduct.id })
    ).rejects.toThrow(ShipmentIdentityLockedError);

    const unchanged = await testPrisma.shipment.findUniqueOrThrow({ where: { id: shipment.id } });
    expect(unchanged.productId).toBe(product.id);
  });

  it("rejects changing productId once the batch has an inventory adjustment", async () => {
    const { user, manufacturer, product } = await createBaseFixtures();
    const otherProduct = await createProduct();
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
    await createAdjustment(testPrisma, {
      shipmentId: shipment.id,
      quantityDelta: -1,
      reason: AdjustmentReason.DAMAGE,
      effectiveDate: "2026-01-03",
      actingUserId: user.id,
    });

    await expect(
      editShipment(testPrisma, shipment.id, { productId: otherProduct.id })
    ).rejects.toThrow(ShipmentIdentityLockedError);
  });

  it("allows changing productId when the batch has no allocations or adjustments", async () => {
    const { user, manufacturer, product } = await createBaseFixtures();
    const otherProduct = await createProduct();
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

    const updated = await editShipment(testPrisma, shipment.id, { productId: otherProduct.id });
    expect(updated.productId).toBe(otherProduct.id);
  });

  it("rejects changing arrivalDate once the batch has a sale allocation", async () => {
    const { user, manufacturer, product, saleRoute } = await createBaseFixtures();
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
    await createSale(testPrisma, {
      productId: product.id,
      quantity: 2,
      pricePerUnit: "25.00",
      saleRouteId: saleRoute.id,
      loggedByUserId: user.id,
    });

    await expect(
      editShipment(testPrisma, shipment.id, { arrivalDate: "2026-01-10" })
    ).rejects.toThrow(ShipmentIdentityLockedError);
    await expect(
      editShipment(testPrisma, shipment.id, { arrivalDate: null })
    ).rejects.toThrow(ShipmentIdentityLockedError);
  });

  it("allows changing arrivalDate when the batch has no sale allocations yet", async () => {
    const { user, manufacturer, product } = await createBaseFixtures();
    const shipment = await createShipment({
      manufacturerId: manufacturer.id,
      productId: product.id,
      loggedByUserId: user.id,
      quantityOrdered: 10,
      productCost: "100.00",
      shippingFee: "0.00",
      orderDate: "2026-01-01",
      arrivalDate: null,
    });

    const updated = await editShipment(testPrisma, shipment.id, { arrivalDate: "2026-01-05" });
    expect(updated.arrivalDate).not.toBeNull();
  });
});
