import { describe, expect, it } from "vitest";
import { testPrisma } from "../db";
import { createSale, deleteSale, editSale, InsufficientStockError } from "@/lib/sales";
import { computeSellThroughDate } from "@/lib/metrics";
import { createBaseFixtures, createShipment } from "./factories";

describe("createSale", () => {
  it("allocates entirely from a single batch when it has enough stock", async () => {
    const { user, manufacturer, product, saleRoute } = await createBaseFixtures();
    const shipment = await createShipment({
      manufacturerId: manufacturer.id,
      productId: product.id,
      loggedByUserId: user.id,
      quantityOrdered: 10,
      productCost: "100.00",
      shippingFee: "0.00",
      orderDate: "2026-01-01",
      arrivalDate: "2026-01-05",
    });

    const sale = await createSale(testPrisma, {
      productId: product.id,
      quantity: 4,
      pricePerUnit: "25.00",
      saleRouteId: saleRoute.id,
      loggedByUserId: user.id,
    });

    expect(sale.allocations).toHaveLength(1);
    expect(sale.allocations[0]).toMatchObject({
      shipmentId: shipment.id,
      quantity: 4,
      unitStartIndex: 0,
      costBasisCents: 4000, // 4 * (10000 cents / 10 units) = 4000
    });
  });

  it("spans multiple batches in FIFO (oldest arrival first) order", async () => {
    const { user, manufacturer, product, saleRoute } = await createBaseFixtures();
    const older = await createShipment({
      manufacturerId: manufacturer.id,
      productId: product.id,
      loggedByUserId: user.id,
      quantityOrdered: 5,
      productCost: "50.00",
      shippingFee: "0.00",
      orderDate: "2026-01-01",
      arrivalDate: "2026-01-02",
    });
    const newer = await createShipment({
      manufacturerId: manufacturer.id,
      productId: product.id,
      loggedByUserId: user.id,
      quantityOrdered: 5,
      productCost: "50.00",
      shippingFee: "0.00",
      orderDate: "2026-01-03",
      arrivalDate: "2026-01-04",
    });

    const sale = await createSale(testPrisma, {
      productId: product.id,
      quantity: 8,
      pricePerUnit: "25.00",
      saleRouteId: saleRoute.id,
      loggedByUserId: user.id,
    });

    const byShipment = new Map(sale.allocations.map((a) => [a.shipmentId, a]));
    expect(byShipment.get(older.id)?.quantity).toBe(5);
    expect(byShipment.get(newer.id)?.quantity).toBe(3);
  });

  it("rejects the whole sale with no partial allocation when stock is insufficient", async () => {
    const { user, manufacturer, product, saleRoute } = await createBaseFixtures();
    await createShipment({
      manufacturerId: manufacturer.id,
      productId: product.id,
      loggedByUserId: user.id,
      quantityOrdered: 3,
      productCost: "30.00",
      shippingFee: "0.00",
      orderDate: "2026-01-01",
      arrivalDate: "2026-01-02",
    });

    await expect(
      createSale(testPrisma, {
        productId: product.id,
        quantity: 10,
        pricePerUnit: "25.00",
        saleRouteId: saleRoute.id,
        loggedByUserId: user.id,
      })
    ).rejects.toThrow(InsufficientStockError);

    const allocations = await testPrisma.saleAllocation.findMany();
    expect(allocations).toHaveLength(0);
    const sales = await testPrisma.sale.findMany();
    expect(sales).toHaveLength(0);
  });

  it("ignores batches that haven't arrived yet (arrivalDate null)", async () => {
    const { user, manufacturer, product, saleRoute } = await createBaseFixtures();
    await createShipment({
      manufacturerId: manufacturer.id,
      productId: product.id,
      loggedByUserId: user.id,
      quantityOrdered: 10,
      productCost: "100.00",
      shippingFee: "0.00",
      orderDate: "2026-01-01",
      arrivalDate: null,
    });

    await expect(
      createSale(testPrisma, {
        productId: product.id,
        quantity: 1,
        pricePerUnit: "10.00",
        saleRouteId: saleRoute.id,
        loggedByUserId: user.id,
      })
    ).rejects.toThrow(InsufficientStockError);
  });
});

describe("computeSellThroughDate", () => {
  it("returns null while a batch still has remaining stock", async () => {
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

    expect(await computeSellThroughDate(testPrisma, shipment.id)).toBeNull();
  });

  it("returns the sale date of the allocation that emptied the batch on exact sell-out", async () => {
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
      quantity: 5,
      pricePerUnit: "25.00",
      saleRouteId: saleRoute.id,
      loggedByUserId: user.id,
    });

    const sellThrough = await computeSellThroughDate(testPrisma, shipment.id);
    expect(sellThrough).not.toBeNull();
    expect(sellThrough!.toISOString().slice(0, 10)).toBe(
      new Date().toISOString().slice(0, 10) // saleDate is server-set to "today"
    );
  });
});

describe("simultaneous sales (oversell protection)", () => {
  it("never oversells a batch under concurrent sale creation", async () => {
    const { user, manufacturer, product, saleRoute } = await createBaseFixtures();
    await createShipment({
      manufacturerId: manufacturer.id,
      productId: product.id,
      loggedByUserId: user.id,
      quantityOrdered: 10,
      productCost: "100.00",
      shippingFee: "0.00",
      orderDate: "2026-01-01",
      arrivalDate: "2026-01-02",
    });

    // Three concurrent sales of 4 units each against only 10 available —
    // exactly one must fail as insufficient stock (10 = 4+4+2, not 4+4+4).
    const results = await Promise.allSettled(
      Array.from({ length: 3 }, () =>
        createSale(testPrisma, {
          productId: product.id,
          quantity: 4,
          pricePerUnit: "25.00",
          saleRouteId: saleRoute.id,
          loggedByUserId: user.id,
        })
      )
    );

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(2);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(InsufficientStockError);

    const totalAllocated = await testPrisma.saleAllocation.aggregate({
      _sum: { quantity: true },
    });
    expect(totalAllocated._sum.quantity).toBe(8);
  });
});

describe("editSale", () => {
  it("repacks a batch's remaining allocations after quantity is reduced, moving the edited sale behind untouched ones", async () => {
    const { user, manufacturer, product, saleRoute } = await createBaseFixtures();
    await createShipment({
      manufacturerId: manufacturer.id,
      productId: product.id,
      loggedByUserId: user.id,
      quantityOrdered: 10,
      productCost: "100.00",
      shippingFee: "0.00",
      orderDate: "2026-01-01",
      arrivalDate: "2026-01-02",
    });

    const saleA = await createSale(testPrisma, {
      productId: product.id,
      quantity: 3,
      pricePerUnit: "25.00",
      saleRouteId: saleRoute.id,
      loggedByUserId: user.id,
    });
    const saleB = await createSale(testPrisma, {
      productId: product.id,
      quantity: 3,
      pricePerUnit: "25.00",
      saleRouteId: saleRoute.id,
      loggedByUserId: user.id,
    });
    // saleA: start 0, qty 3; saleB: start 3, qty 3.

    await editSale(testPrisma, saleA.id, {
      quantity: 1,
      pricePerUnit: "25.00",
      saleRouteId: saleRoute.id,
    });

    const allocA = await testPrisma.saleAllocation.findFirstOrThrow({ where: { saleId: saleA.id } });
    const allocB = await testPrisma.saleAllocation.findFirstOrThrow({ where: { saleId: saleB.id } });

    expect(allocA.quantity).toBe(1);
    // Editing a sale deletes its old allocation and creates a brand new
    // one with a fresh (higher) `sequence` — so it now sorts *after*
    // saleB's untouched allocation in the repack, even though saleA was
    // created first. This is intentional: `sequence` tracks true
    // chronological allocation order, and re-allocating counts as new.
    expect(allocB.unitStartIndex).toBe(0);
    expect(allocA.unitStartIndex).toBe(3);

    const total = await testPrisma.saleAllocation.aggregate({ _sum: { quantity: true } });
    expect(total._sum.quantity).toBe(4);

    // $100.00 / 10 units = 1000 cents/unit exactly (no remainder to split).
    expect(allocB.costBasisCents).toBe(3000);
    expect(allocA.costBasisCents).toBe(1000);
  });

  it("rejects an edit that would require more stock than is available", async () => {
    const { user, manufacturer, product, saleRoute } = await createBaseFixtures();
    await createShipment({
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
      pricePerUnit: "25.00",
      saleRouteId: saleRoute.id,
      loggedByUserId: user.id,
    });

    await expect(
      editSale(testPrisma, sale.id, {
        quantity: 6,
        pricePerUnit: "25.00",
        saleRouteId: saleRoute.id,
      })
    ).rejects.toThrow(InsufficientStockError);
  });
});

describe("deleteSale", () => {
  it("closes the gap by repacking the batch's remaining allocations", async () => {
    const { user, manufacturer, product, saleRoute } = await createBaseFixtures();
    await createShipment({
      manufacturerId: manufacturer.id,
      productId: product.id,
      loggedByUserId: user.id,
      quantityOrdered: 10,
      productCost: "100.00",
      shippingFee: "0.00",
      orderDate: "2026-01-01",
      arrivalDate: "2026-01-02",
    });

    const saleA = await createSale(testPrisma, {
      productId: product.id,
      quantity: 3,
      pricePerUnit: "25.00",
      saleRouteId: saleRoute.id,
      loggedByUserId: user.id,
    });
    const saleB = await createSale(testPrisma, {
      productId: product.id,
      quantity: 3,
      pricePerUnit: "25.00",
      saleRouteId: saleRoute.id,
      loggedByUserId: user.id,
    });

    await deleteSale(testPrisma, saleA.id);

    const remainingSales = await testPrisma.sale.findMany();
    expect(remainingSales).toHaveLength(1);
    expect(remainingSales[0].id).toBe(saleB.id);

    const allocB = await testPrisma.saleAllocation.findFirstOrThrow({ where: { saleId: saleB.id } });
    expect(allocB.unitStartIndex).toBe(0); // shifted down after saleA's allocation was removed

    const deletedAllocations = await testPrisma.saleAllocation.findMany({
      where: { saleId: saleA.id },
    });
    expect(deletedAllocations).toHaveLength(0); // cascaded
  });
});
