import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { decimalToCents, recomputeBatchAllocations } from "./money";

export interface RepackableShipment {
  id: string;
  quantityOrdered: number;
  productCost: Prisma.Decimal | string;
  shippingFee: Prisma.Decimal | string;
}

/**
 * Re-derives unitStartIndex/costBasisCents for every surviving
 * allocation against one batch, from scratch, in true chronological
 * (sequence) order. Call this inside the same transaction that holds
 * the batch's row lock, any time an allocation is added, removed, or
 * resized for that batch, or the batch's own cost fields change.
 */
export async function repackShipmentAllocations(
  tx: Prisma.TransactionClient | PrismaClient,
  shipment: RepackableShipment
): Promise<void> {
  const totalCents = decimalToCents(shipment.productCost) + decimalToCents(shipment.shippingFee);
  const existing = await tx.saleAllocation.findMany({
    where: { shipmentId: shipment.id },
    orderBy: { sequence: "asc" },
    select: { id: true, quantity: true },
  });
  const recomputed = recomputeBatchAllocations(totalCents, shipment.quantityOrdered, existing);
  for (const allocation of recomputed) {
    await tx.saleAllocation.update({
      where: { id: allocation.id },
      data: {
        unitStartIndex: allocation.unitStartIndex,
        costBasisCents: allocation.costBasisCents,
      },
    });
  }
}
