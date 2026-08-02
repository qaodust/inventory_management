import { AdjustmentReason } from "@/generated/prisma/client";
import { testPrisma } from "../db";

let counter = 0;
function unique(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}-${Date.now()}`;
}

export async function createUser() {
  return testPrisma.user.create({
    data: {
      email: `${unique("user")}@example.com`,
      passwordHash: "not-a-real-hash",
      name: "Test User",
    },
  });
}

export async function createManufacturer() {
  return testPrisma.manufacturer.create({
    data: { name: unique("manufacturer") },
  });
}

export async function createProduct() {
  return testPrisma.product.create({
    data: { name: unique("product") },
  });
}

export async function createSaleRoute() {
  return testPrisma.saleRoute.create({
    data: { name: unique("route") },
  });
}

export interface ShipmentFixtureInput {
  manufacturerId: string;
  productId: string;
  loggedByUserId: string;
  quantityOrdered: number;
  productCost: string;
  shippingFee: string;
  /** "YYYY-MM-DD" */
  orderDate: string;
  arrivalDate?: string | null;
  expectedArrivalDate?: string | null;
}

function utcDate(dateString: string): Date {
  return new Date(`${dateString}T00:00:00.000Z`);
}

export async function createShipment(input: ShipmentFixtureInput) {
  return testPrisma.shipment.create({
    data: {
      manufacturerId: input.manufacturerId,
      productId: input.productId,
      loggedByUserId: input.loggedByUserId,
      quantityOrdered: input.quantityOrdered,
      productCost: input.productCost,
      shippingFee: input.shippingFee,
      orderDate: utcDate(input.orderDate),
      arrivalDate: input.arrivalDate ? utcDate(input.arrivalDate) : null,
      expectedArrivalDate: input.expectedArrivalDate ? utcDate(input.expectedArrivalDate) : null,
    },
  });
}

/** Bundles a User + Manufacturer + Product + SaleRoute — the common fixture set nearly every test needs. */
export async function createBaseFixtures() {
  const [user, manufacturer, product, saleRoute] = await Promise.all([
    createUser(),
    createManufacturer(),
    createProduct(),
    createSaleRoute(),
  ]);
  return { user, manufacturer, product, saleRoute };
}

export { AdjustmentReason };
