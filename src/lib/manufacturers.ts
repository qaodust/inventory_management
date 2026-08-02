import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Minimum number of arrived shipments (with an expected arrival date on
 * file) before a reliability percentage is considered meaningful. 1/1
 * = "100% reliable" off a single shipment would be misleading; this is
 * a defensible floor, not a business-mandated number — tune freely.
 */
export const MIN_SHIPMENTS_FOR_RELIABILITY = 5;

export type ReliabilityResult =
  | { status: "insufficient-data"; sampleSize: number }
  | { status: "ok"; onTimePct: number; sampleSize: number };

/**
 * % of a manufacturer's arrived shipments that arrived on or before
 * their expected arrival date. Only shipments that have both actually
 * arrived and had an expected date on file count toward the sample —
 * a still-pending shipment isn't "late" yet, just not arrived.
 */
export async function computeReliability(
  prisma: PrismaClient,
  manufacturerId: string
): Promise<ReliabilityResult> {
  const shipments = await prisma.shipment.findMany({
    where: {
      manufacturerId,
      arrivalDate: { not: null },
      expectedArrivalDate: { not: null },
    },
    select: { arrivalDate: true, expectedArrivalDate: true },
  });

  if (shipments.length < MIN_SHIPMENTS_FOR_RELIABILITY) {
    return { status: "insufficient-data", sampleSize: shipments.length };
  }

  const onTime = shipments.filter((s) => s.arrivalDate! <= s.expectedArrivalDate!).length;
  return {
    status: "ok",
    onTimePct: (onTime / shipments.length) * 100,
    sampleSize: shipments.length,
  };
}
