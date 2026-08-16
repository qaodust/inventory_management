import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readRemainingQty } from "@/lib/metrics";
import { nyTodayDateString } from "@/lib/dates";
import { AdjustInventoryForm } from "./AdjustInventoryForm";

export default async function AdjustInventoryPage({
  params,
}: {
  params: Promise<{ id: string; shipmentId: string }>;
}) {
  const { id: productId, shipmentId } = await params;

  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment || shipment.productId !== productId) notFound();

  const remainingMap = await readRemainingQty(prisma, [shipmentId]);
  const currentRemaining = remainingMap.get(shipmentId) ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Adjust Inventory</h1>
      <AdjustInventoryForm
        productId={productId}
        shipmentId={shipmentId}
        currentRemaining={currentRemaining}
        quantityOrdered={shipment.quantityOrdered}
        today={nyTodayDateString()}
      />
    </div>
  );
}
