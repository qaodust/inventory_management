import { AdjustmentReason, type PrismaClient } from "@/generated/prisma/client";
import { nyDateStringToUtcDate } from "./dates";
import { getRemainingQty, lockShipment } from "./locking";

export class AdjustmentWouldGoNegativeError extends Error {
  constructor(currentRemaining: number, quantityDelta: number) {
    super(
      `Cannot apply adjustment of ${quantityDelta}: batch has ${currentRemaining} ` +
        `unit(s) remaining and this would drive that negative.`
    );
    this.name = "AdjustmentWouldGoNegativeError";
  }
}

export interface CreateAdjustmentInput {
  shipmentId: string;
  quantityDelta: number;
  reason: AdjustmentReason;
  note?: string | null;
  /** "YYYY-MM-DD" */
  effectiveDate: string;
  actingUserId: string;
}

/**
 * Records an inventory adjustment against a batch. Locks the batch row
 * first so the remaining-quantity floor check is consistent against any
 * concurrent sale/adjustment/shipment-edit on the same batch.
 */
export async function createAdjustment(prisma: PrismaClient, input: CreateAdjustmentInput) {
  if (input.quantityDelta === 0) {
    throw new Error("quantityDelta must not be zero");
  }
  if (input.reason === AdjustmentReason.OTHER && !input.note) {
    throw new Error('note is required when reason is "OTHER"');
  }

  return prisma.$transaction(async (tx) => {
    const locked = await lockShipment(tx, input.shipmentId);
    if (!locked) {
      throw new Error(`Shipment ${input.shipmentId} not found`);
    }

    const remainingMap = await getRemainingQty(tx, [input.shipmentId]);
    const currentRemaining = remainingMap.get(input.shipmentId) ?? 0;
    if (currentRemaining + input.quantityDelta < 0) {
      throw new AdjustmentWouldGoNegativeError(currentRemaining, input.quantityDelta);
    }

    return tx.inventoryAdjustment.create({
      data: {
        shipmentId: input.shipmentId,
        quantityDelta: input.quantityDelta,
        reason: input.reason,
        note: input.note ?? null,
        effectiveDate: nyDateStringToUtcDate(input.effectiveDate),
        actingUserId: input.actingUserId,
      },
    });
  });
}
