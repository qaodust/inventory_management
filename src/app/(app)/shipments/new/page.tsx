import { prisma } from "@/lib/prisma";
import { nyTodayDateString } from "@/lib/dates";
import { NewShipmentForm } from "./NewShipmentForm";

export default async function NewShipmentPage() {
  const [manufacturers, products] = await Promise.all([
    prisma.manufacturer.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { hidden: false }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Log New Shipment</h1>
      <NewShipmentForm
        manufacturers={manufacturers}
        products={products}
        today={nyTodayDateString()}
      />
    </div>
  );
}
