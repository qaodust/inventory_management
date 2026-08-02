import type { PrismaClient } from "@/generated/prisma/client";

/**
 * The date a batch fully sold out — i.e. the sale date of the
 * chronologically-last sale allocation drawn against it, once sale
 * allocations alone (ignoring inventory adjustments) have consumed the
 * batch's entire original quantityOrdered. Returns null if sales alone
 * haven't consumed the batch yet. Deliberately ignores adjustments when
 * deciding *whether* the batch sold through: a damage/loss adjustment
 * that zeroes out remaining stock is not the same as the batch's units
 * being sold, so it must not be reported as a sell-through date.
 */
export async function computeSellThroughDate(
  prisma: PrismaClient,
  shipmentId: string
): Promise<Date | null> {
  const shipment = await prisma.shipment.findUniqueOrThrow({
    where: { id: shipmentId },
    select: { quantityOrdered: true },
  });

  const allocationSum = await prisma.saleAllocation.aggregate({
    where: { shipmentId },
    _sum: { quantity: true },
  });

  const remainingViaSalesOnly =
    shipment.quantityOrdered - (allocationSum._sum.quantity ?? 0);

  if (remainingViaSalesOnly > 0) return null;

  const lastAllocation = await prisma.saleAllocation.findFirst({
    where: { shipmentId },
    orderBy: { sequence: "desc" },
    include: { sale: { select: { saleDate: true } } },
  });

  return lastAllocation?.sale.saleDate ?? null;
}
