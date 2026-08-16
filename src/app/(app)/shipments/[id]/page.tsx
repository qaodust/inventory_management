import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { utcDateToDateString } from "@/lib/dates";
import { EditShipmentForm } from "./EditShipmentForm";
import { DeleteShipmentButton } from "./DeleteShipmentButton";

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [shipment, manufacturers, products] = await Promise.all([
    prisma.shipment.findUnique({ where: { id } }),
    prisma.manufacturer.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!shipment) notFound();

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <div className="flex w-full flex-col gap-4 md:w-1/2">
        <h1 className="text-2xl font-semibold">Shipment</h1>
        <EditShipmentForm
          shipmentId={shipment.id}
          manufacturers={manufacturers}
          products={products}
          manufacturerId={shipment.manufacturerId}
          productId={shipment.productId}
          quantityOrdered={shipment.quantityOrdered}
          productCost={shipment.productCost.toFixed(2)}
          shippingFee={shipment.shippingFee.toFixed(2)}
          orderDate={utcDateToDateString(shipment.orderDate)}
          expectedArrivalDate={
            shipment.expectedArrivalDate ? utcDateToDateString(shipment.expectedArrivalDate) : ""
          }
          arrivalDate={shipment.arrivalDate ? utcDateToDateString(shipment.arrivalDate) : ""}
        />
        <DeleteShipmentButton shipmentId={shipment.id} />
      </div>
    </div>
  );
}
