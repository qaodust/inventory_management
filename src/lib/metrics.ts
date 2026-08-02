import type { PrismaClient } from "@/generated/prisma/client";

/**
 * The date a batch fully sold out — i.e. the sale date of the
 * chronologically-last sale allocation drawn against it, once the
 * batch's derived remaining quantity reaches zero. Returns null if the
 * batch still has stock remaining. Note: if a batch's last unit(s) are
 * removed via an inventory adjustment (damage/loss) rather than sold,
 * this still reports the last sale that touched the batch, not the
 * adjustment — "sell-through" is specifically about sales.
 */
export async function computeSellThroughDate(
  prisma: PrismaClient,
  shipmentId: string
): Promise<Date | null> {
  const shipment = await prisma.shipment.findUniqueOrThrow({
    where: { id: shipmentId },
    select: { quantityOrdered: true },
  });

  const [adjustmentSum, allocationSum] = await Promise.all([
    prisma.inventoryAdjustment.aggregate({
      where: { shipmentId },
      _sum: { quantityDelta: true },
    }),
    prisma.saleAllocation.aggregate({
      where: { shipmentId },
      _sum: { quantity: true },
    }),
  ]);

  const remaining =
    shipment.quantityOrdered +
    (adjustmentSum._sum.quantityDelta ?? 0) -
    (allocationSum._sum.quantity ?? 0);

  if (remaining > 0) return null;

  const lastAllocation = await prisma.saleAllocation.findFirst({
    where: { shipmentId },
    orderBy: { sequence: "desc" },
    include: { sale: { select: { saleDate: true } } },
  });

  return lastAllocation?.sale.saleDate ?? null;
}
