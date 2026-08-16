import { Prisma, type PrismaClient } from "@/generated/prisma/client";

export class InvalidGoalPriceError extends Error {
  constructor(value: string | number) {
    super(`Goal price must be zero or a positive amount, got ${value}.`);
    this.name = "InvalidGoalPriceError";
  }
}

/** undefined = field not supplied (leave untouched on edit); null = explicitly cleared. */
function parseGoalPrice(
  value: string | number | null | undefined
): Prisma.Decimal | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const decimal = new Prisma.Decimal(value);
  if (decimal.isNegative()) throw new InvalidGoalPriceError(value);
  return decimal;
}

/**
 * Resolves the category a product form submitted: reuses an existing
 * category by case-insensitive name match, or creates one, when
 * `newCategoryName` is set (the form's inline "add new category"
 * option) — otherwise passes `categoryId` straight through. Categories
 * are a user-managed controlled list purely for filtering, so adding
 * one inline should never require a deployment or hit a duplicate error.
 */
async function resolveCategory(
  tx: Prisma.TransactionClient,
  categoryId: string | null | undefined,
  newCategoryName: string | null | undefined
): Promise<string | null | undefined> {
  const trimmedNew = newCategoryName?.trim();
  if (trimmedNew) {
    const existing = await tx.category.findFirst({
      where: { name: { equals: trimmedNew, mode: "insensitive" } },
    });
    if (existing) return existing.id;
    const created = await tx.category.create({ data: { name: trimmedNew } });
    return created.id;
  }
  return categoryId;
}

export interface ProductFieldsInput {
  categoryId?: string | null;
  /** Inline "add new category" option — takes precedence over categoryId when set. */
  newCategoryName?: string | null;
  goalPrice?: string | number | null;
  hidden?: boolean;
}

export interface CreateProductInput extends ProductFieldsInput {
  name: string;
}

export async function createProduct(prisma: PrismaClient, input: CreateProductInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Product name is required.");
  const goalPrice = parseGoalPrice(input.goalPrice);

  return prisma.$transaction(async (tx) => {
    const categoryId = await resolveCategory(tx, input.categoryId ?? null, input.newCategoryName);
    return tx.product.create({
      data: {
        name,
        categoryId: categoryId ?? null,
        goalPrice: goalPrice ?? null,
        hidden: input.hidden ?? false,
      },
    });
  });
}

export interface EditProductInput extends ProductFieldsInput {
  name?: string;
}

export async function editProduct(prisma: PrismaClient, id: string, input: EditProductInput) {
  const name = input.name !== undefined ? input.name.trim() : undefined;
  if (name !== undefined && !name) throw new Error("Product name is required.");
  const goalPrice = parseGoalPrice(input.goalPrice);

  return prisma.$transaction(async (tx) => {
    const categoryId = await resolveCategory(tx, input.categoryId, input.newCategoryName);
    return tx.product.update({
      where: { id },
      data: {
        name,
        categoryId,
        goalPrice,
        hidden: input.hidden,
      },
    });
  });
}

/** Archive/unarchive is a dedicated action separate from the edit form, per design.md. */
export async function setProductHidden(prisma: PrismaClient, id: string, hidden: boolean) {
  return prisma.product.update({ where: { id }, data: { hidden } });
}
