import { describe, expect, it } from "vitest";
import { testPrisma } from "../db";
import { createSale } from "@/lib/sales";
import { editShipment, ShipmentQuantityReductionError } from "@/lib/shipments";
import { createBaseFixtures, createShipment } from "./factories";

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
});
