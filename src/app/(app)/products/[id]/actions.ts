"use server";

import { revalidatePath } from "next/cache";
import { editProduct, InvalidGoalPriceError, setProductHidden } from "@/lib/products";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/dal";
import { parseCategoryField } from "@/lib/actions/category-field";

export type EditProductState = { error?: string; success?: boolean } | undefined;

export async function editProductAction(
  productId: string,
  _prevState: EditProductState,
  formData: FormData
): Promise<EditProductState> {
  await requireSession();

  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) {
    return { error: "Product name is required." };
  }

  const goalPrice = formData.get("goalPrice");
  const { categoryId, newCategoryName } = parseCategoryField(formData);

  try {
    await editProduct(prisma, productId, {
      name,
      categoryId,
      newCategoryName,
      goalPrice: typeof goalPrice === "string" ? goalPrice : null,
    });
  } catch (err) {
    if (err instanceof InvalidGoalPriceError) {
      return { error: err.message };
    }
    throw err;
  }

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  return { success: true };
}

export async function setProductArchivedAction(productId: string, hidden: boolean) {
  await requireSession();
  await setProductHidden(prisma, productId, hidden);
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
}
