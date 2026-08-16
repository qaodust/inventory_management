"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSale, InsufficientStockError } from "@/lib/sales";
import { parseSaleRouteField } from "@/lib/actions/sale-route-field";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/dal";

export type NewSaleState = { error?: string } | undefined;

function requiredString(formData: FormData, field: string): string | undefined {
  const value = formData.get(field);
  return typeof value === "string" && value !== "" ? value : undefined;
}

export async function createSaleAction(
  _prevState: NewSaleState,
  formData: FormData
): Promise<NewSaleState> {
  const session = await requireSession();

  const productId = requiredString(formData, "productId");
  const quantityRaw = requiredString(formData, "quantity");
  const pricePerUnit = requiredString(formData, "pricePerUnit");
  const { saleRouteId, newSaleRouteName } = parseSaleRouteField(formData);

  if (!productId) {
    return { error: "Product is required." };
  }
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

  let sale;
  try {
    sale = await createSale(prisma, {
      productId,
      quantity,
      pricePerUnit,
      saleRouteId,
      newSaleRouteName,
      loggedByUserId: session.user.id,
    });
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return { error: `Not enough stock — short by ${err.insufficientBy} unit(s).` };
    }
    throw err;
  }

  revalidatePath("/sales");
  revalidatePath("/products");
  redirect(`/sales/${sale.id}`);
}
