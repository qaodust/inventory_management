"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createAdjustment,
  AdjustmentWouldGoNegativeError,
  AdjustmentWouldExceedQuantityError,
} from "@/lib/inventory-adjustments";
import { AdjustmentReason } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/dal";

export type AdjustInventoryState = { error?: string } | undefined;

const VALID_REASONS = new Set(Object.values(AdjustmentReason));

export async function adjustInventoryAction(
  productId: string,
  shipmentId: string,
  _prevState: AdjustInventoryState,
  formData: FormData
): Promise<AdjustInventoryState> {
  const session = await requireSession();

  const quantityDeltaRaw = formData.get("quantityDelta");
  const reasonRaw = formData.get("reason");
  const noteRaw = formData.get("note");
  const effectiveDate = formData.get("effectiveDate");

  const quantityDelta = typeof quantityDeltaRaw === "string" ? Number(quantityDeltaRaw) : NaN;
  if (!Number.isInteger(quantityDelta) || quantityDelta === 0) {
    return { error: "Quantity change must be a non-zero whole number." };
  }
  if (typeof reasonRaw !== "string" || !VALID_REASONS.has(reasonRaw as AdjustmentReason)) {
    return { error: "Select a valid reason." };
  }
  if (typeof effectiveDate !== "string" || !effectiveDate) {
    return { error: "Effective date is required." };
  }
  const note = typeof noteRaw === "string" && noteRaw.trim() ? noteRaw.trim() : null;

  try {
    await createAdjustment(prisma, {
      shipmentId,
      quantityDelta,
      reason: reasonRaw as AdjustmentReason,
      note,
      effectiveDate,
      actingUserId: session.user.id,
    });
  } catch (err) {
    if (
      err instanceof AdjustmentWouldGoNegativeError ||
      err instanceof AdjustmentWouldExceedQuantityError
    ) {
      return { error: err.message };
    }
    if (err instanceof Error && err.message.includes('note is required')) {
      return { error: 'A note is required when reason is "Other".' };
    }
    throw err;
  }

  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
  redirect(`/products/${productId}`);
}
