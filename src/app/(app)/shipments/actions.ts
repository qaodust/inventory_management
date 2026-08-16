"use server";

import { revalidatePath } from "next/cache";
import { editShipment } from "@/lib/shipments";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/dal";

export async function markShipmentArrivedAction(shipmentId: string, formData: FormData) {
  await requireSession();
  const arrivalDate = formData.get("arrivalDate");
  if (typeof arrivalDate !== "string" || !arrivalDate) {
    throw new Error("Arrival date is required.");
  }
  const shipment = await editShipment(prisma, shipmentId, { arrivalDate });
  revalidatePath("/shipments");
  revalidatePath("/products");
  revalidatePath(`/products/${shipment.productId}`);
  revalidatePath("/manufacturers");
  revalidatePath(`/manufacturers/${shipment.manufacturerId}`);
}
