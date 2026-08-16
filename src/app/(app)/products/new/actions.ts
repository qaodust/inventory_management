"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createProduct, InvalidGoalPriceError } from "@/lib/products";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/dal";
import { parseCategoryField } from "@/lib/actions/category-field";

export type NewProductState = { error?: string } | undefined;

export async function createProductAction(
  _prevState: NewProductState,
  formData: FormData
): Promise<NewProductState> {
  await requireSession();

  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) {
    return { error: "Product name is required." };
  }

  const goalPrice = formData.get("goalPrice");
  const { categoryId, newCategoryName } = parseCategoryField(formData);

  let product;
  try {
    product = await createProduct(prisma, {
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
  redirect(`/products/${product.id}`);
}
