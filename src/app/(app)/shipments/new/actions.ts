"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createShipment } from "@/lib/shipments";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/dal";

export type NewShipmentState = { error?: string } | undefined;

function requiredString(formData: FormData, field: string): string | undefined {
  const value = formData.get(field);
  return typeof value === "string" && value !== "" ? value : undefined;
}

export async function createShipmentAction(
  _prevState: NewShipmentState,
  formData: FormData
): Promise<NewShipmentState> {
  const session = await requireSession();

  const manufacturerId = requiredString(formData, "manufacturerId");
  const productId = requiredString(formData, "productId");
  const quantityRaw = requiredString(formData, "quantityOrdered");
  const productCost = requiredString(formData, "productCost");
  const shippingFee = requiredString(formData, "shippingFee");
  const orderDate = requiredString(formData, "orderDate");
  const expectedArrivalDate = requiredString(formData, "expectedArrivalDate") ?? null;

  if (!manufacturerId || !productId) {
    return { error: "Manufacturer and product are required." };
  }
  const quantityOrdered = quantityRaw ? Number(quantityRaw) : NaN;
  if (!Number.isInteger(quantityOrdered) || quantityOrdered <= 0) {
    return { error: "Quantity must be a whole number greater than zero." };
  }
  if (!productCost || !shippingFee) {
    return { error: "Product cost and shipping fee are required." };
  }
  if (Number(productCost) < 0 || Number(shippingFee) < 0) {
    return { error: "Product cost and shipping fee cannot be negative." };
  }
  if (!orderDate) {
    return { error: "Order date is required." };
  }

  const shipment = await createShipment(prisma, {
    manufacturerId,
    productId,
    quantityOrdered,
    productCost,
    shippingFee,
    orderDate,
    expectedArrivalDate,
    loggedByUserId: session.user.id,
  });

  revalidatePath("/shipments");
  redirect(`/shipments/${shipment.id}`);
}
