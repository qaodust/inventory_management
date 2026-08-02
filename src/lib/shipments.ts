import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { nyDateStringToUtcDate } from "./dates";
import { decimalToCents } from "./money";
import { getRemainingQty, lockShipment } from "./locking";
import { repackShipmentAllocations } from "./allocations";

function toUtcDateOrNull(dateString: string | null | undefined): Date | null | undefined {
  if (dateString === undefined) return undefined;
  return dateString === null ? null : nyDateStringToUtcDate(dateString);
}

export interface CreateShipmentInput {
  manufacturerId: string;
  productId: string;
  quantityOrdered: number;
  /** Dollars — Decimal-compatible string or number. */
  productCost: string | number;
  shippingFee: string | number;
  /** "YYYY-MM-DD" */
  orderDate: string;
  expectedArrivalDate?: string | null;
  arrivalDate?: string | null;
  loggedByUserId: string;
}

export async function createShipment(prisma: PrismaClient, input: CreateShipmentInput) {
  return prisma.shipment.create({
    data: {
      manufacturerId: input.manufacturerId,
      productId: input.productId,
      quantityOrdered: input.quantityOrdered,
      productCost: input.productCost,
      shippingFee: input.shippingFee,
      orderDate: nyDateStringToUtcDate(input.orderDate),
      expectedArrivalDate: toUtcDateOrNull(input.expectedArrivalDate) ?? null,
      arrivalDate: toUtcDateOrNull(input.arrivalDate) ?? null,
      loggedByUserId: input.loggedByUserId,
    },
  });
}

export interface EditShipmentInput {
  manufacturerId?: string;
  productId?: string;
  quantityOrdered?: number;
  productCost?: string | number;
  shippingFee?: string | number;
  orderDate?: string;
  expectedArrivalDate?: string | null;
  arrivalDate?: string | null;
}

export class ShipmentQuantityReductionError extends Error {
  constructor(currentRemaining: number, requestedQuantityOrdered: number) {
    super(
      `Cannot reduce quantityOrdered to ${requestedQuantityOrdered}: batch ` +
        `currently has ${currentRemaining} unit(s) remaining and this change ` +
        `would drive that negative.`
    );
    this.name = "ShipmentQuantityReductionError";
  }
}

/**
 * Edits a batch. Rejects a quantityOrdered reduction that would drive
 * the batch's derived remaining quantity negative. If the cost
 * (productCost/shippingFee) or quantity changes, fully repacks every
 * existing allocation against this batch since the per-unit cost split
 * itself changes even with no allocation added or removed.
 */
export async function editShipment(
  prisma: PrismaClient,
  shipmentId: string,
  input: EditShipmentInput
) {
  return prisma.$transaction(async (tx) => {
    const locked = await lockShipment(tx, shipmentId);
    if (!locked) {
      throw new Error(`Shipment ${shipmentId} not found`);
    }

    const newQuantityOrdered = input.quantityOrdered ?? locked.quantityOrdered;
    const quantityDelta = newQuantityOrdered - locked.quantityOrdered;

    if (quantityDelta !== 0) {
      const remainingMap = await getRemainingQty(tx, [shipmentId]);
      const currentRemaining = remainingMap.get(shipmentId) ?? 0;
      if (currentRemaining + quantityDelta < 0) {
        throw new ShipmentQuantityReductionError(currentRemaining, newQuantityOrdered);
      }
    }

    const costChanged =
      (input.productCost !== undefined &&
        decimalToCents(input.productCost) !== decimalToCents(locked.productCost)) ||
      (input.shippingFee !== undefined &&
        decimalToCents(input.shippingFee) !== decimalToCents(locked.shippingFee));

    const updated = await tx.shipment.update({
      where: { id: shipmentId },
      data: {
        manufacturerId: input.manufacturerId,
        productId: input.productId,
        quantityOrdered: newQuantityOrdered,
        productCost: input.productCost,
        shippingFee: input.shippingFee,
        orderDate: input.orderDate ? nyDateStringToUtcDate(input.orderDate) : undefined,
        expectedArrivalDate: toUtcDateOrNull(input.expectedArrivalDate),
        arrivalDate: toUtcDateOrNull(input.arrivalDate),
      },
    });

    if (costChanged || quantityDelta !== 0) {
      await repackShipmentAllocations(tx, {
        id: shipmentId,
        quantityOrdered: updated.quantityOrdered,
        productCost: updated.productCost,
        shippingFee: updated.shippingFee,
      });
    }

    return updated;
  });
}

/**
 * Deletes a batch. The database itself enforces that a batch with
 * existing sale allocations or inventory adjustments can't be
 * hard-deleted (onDelete: Restrict) — this surfaces that as a clearer
 * error rather than a raw Postgres foreign-key violation.
 */
export async function deleteShipment(prisma: PrismaClient, shipmentId: string): Promise<void> {
  try {
    await prisma.shipment.delete({ where: { id: shipmentId } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      throw new Error(
        `Cannot delete shipment ${shipmentId}: it still has sales or inventory ` +
          `adjustments recorded against it. Edit it instead, or remove those first.`,
        { cause: err }
      );
    }
    throw err;
  }
}
