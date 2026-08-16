"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  editShipment,
  deleteShipment,
  ShipmentQuantityReductionError,
  ShipmentIdentityLockedError,
} from "@/lib/shipments";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/dal";

export type EditShipmentState = { error?: string; success?: boolean } | undefined;

function requiredString(formData: FormData, field: string): string | undefined {
  const value = formData.get(field);
  return typeof value === "string" && value !== "" ? value : undefined;
}

export async function editShipmentAction(
  shipmentId: string,
  _prevState: EditShipmentState,
  formData: FormData
): Promise<EditShipmentState> {
  await requireSession();

  const manufacturerId = requiredString(formData, "manufacturerId");
  const productId = requiredString(formData, "productId");
  const quantityRaw = requiredString(formData, "quantityOrdered");
  const productCost = requiredString(formData, "productCost");
  const shippingFee = requiredString(formData, "shippingFee");
  const orderDate = requiredString(formData, "orderDate");
  const expectedArrivalDate = requiredString(formData, "expectedArrivalDate") ?? null;
  const arrivalDate = requiredString(formData, "arrivalDate") ?? null;

  const quantityOrdered = quantityRaw ? Number(quantityRaw) : undefined;
  if (quantityRaw !== undefined && (!Number.isInteger(quantityOrdered) || quantityOrdered! <= 0)) {
    return { error: "Quantity must be a whole number greater than zero." };
  }
  if (
    (productCost !== undefined && Number(productCost) < 0) ||
    (shippingFee !== undefined && Number(shippingFee) < 0)
  ) {
    return { error: "Product cost and shipping fee cannot be negative." };
  }

  try {
    await editShipment(prisma, shipmentId, {
      manufacturerId,
      productId,
      quantityOrdered,
      productCost,
      shippingFee,
      orderDate,
      expectedArrivalDate,
      arrivalDate,
    });
  } catch (err) {
    if (err instanceof ShipmentQuantityReductionError || err instanceof ShipmentIdentityLockedError) {
      return { error: err.message };
    }
    throw err;
  }

  revalidatePath("/shipments");
  revalidatePath(`/shipments/${shipmentId}`);
  revalidatePath("/products");
  revalidatePath("/manufacturers");
  return { success: true };
}

export type DeleteShipmentState = { error?: string } | undefined;

export async function deleteShipmentAction(
  shipmentId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState requires this signature
  _prevState: DeleteShipmentState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState requires this signature
  _formData: FormData
): Promise<DeleteShipmentState> {
  await requireSession();

  try {
    await deleteShipment(prisma, shipmentId);
  } catch (err) {
    if (err instanceof Error) {
      return { error: err.message };
    }
    throw err;
  }

  revalidatePath("/shipments");
  revalidatePath("/products");
  revalidatePath("/manufacturers");
  redirect("/shipments");
}
