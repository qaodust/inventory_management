"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { editSale, deleteSale, InsufficientStockError } from "@/lib/sales";
import { parseSaleRouteField } from "@/lib/actions/sale-route-field";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/dal";

export type EditSaleState = { error?: string; success?: boolean } | undefined;

function requiredString(formData: FormData, field: string): string | undefined {
  const value = formData.get(field);
  return typeof value === "string" && value !== "" ? value : undefined;
}

export async function editSaleAction(
  saleId: string,
  _prevState: EditSaleState,
  formData: FormData
): Promise<EditSaleState> {
  await requireSession();

  const quantityRaw = requiredString(formData, "quantity");
  const pricePerUnit = requiredString(formData, "pricePerUnit");
  const { saleRouteId, newSaleRouteName } = parseSaleRouteField(formData);

  const quantity = quantityRaw ? Number(quantityRaw) : NaN;
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { error: "Quantity must be a whole number greater than zero." };
  }
  if (!pricePerUnit || Number(pricePerUnit) < 0) {
    return { error: "Price per unit must be zero or a positive amount." };
  }
  if (!saleRouteId && !newSaleRouteName?.trim()) {
    return { error: "Sale route is required." };
  }

  try {
    await editSale(prisma, saleId, { quantity, pricePerUnit, saleRouteId, newSaleRouteName });
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return { error: `Not enough stock — short by ${err.insufficientBy} unit(s).` };
    }
    throw err;
  }

  revalidatePath("/sales");
  revalidatePath("/sales/history");
  revalidatePath(`/sales/${saleId}`);
  revalidatePath("/products");
  return { success: true };
}

export type DeleteSaleState = { error?: string } | undefined;

export async function deleteSaleAction(
  saleId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState requires this signature
  _prevState: DeleteSaleState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState requires this signature
  _formData: FormData
): Promise<DeleteSaleState> {
  await requireSession();

  try {
    await deleteSale(prisma, saleId);
  } catch (err) {
    if (err instanceof Error) {
      return { error: err.message };
    }
    throw err;
  }

  revalidatePath("/sales");
  revalidatePath("/sales/history");
  revalidatePath("/products");
  redirect("/sales/history");
}
