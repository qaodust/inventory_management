"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createManufacturer,
  DuplicateManufacturerNameError,
  InvalidRatingError,
} from "@/lib/manufacturers";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/dal";
import { parseRatingField } from "@/lib/actions/rating-field";

export type NewManufacturerState = { error?: string } | undefined;

export async function createManufacturerAction(
  _prevState: NewManufacturerState,
  formData: FormData
): Promise<NewManufacturerState> {
  await requireSession();

  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) {
    return { error: "Manufacturer name is required." };
  }

  let qualityRating: number | null;
  let easeOfUseRating: number | null;
  try {
    qualityRating = parseRatingField(formData.get("qualityRating"));
    easeOfUseRating = parseRatingField(formData.get("easeOfUseRating"));
  } catch {
    return { error: "Ratings must be between 1 and 5." };
  }

  const qualityNote = formData.get("qualityNote");
  const easeOfUseNote = formData.get("easeOfUseNote");

  let manufacturer;
  try {
    manufacturer = await createManufacturer(prisma, {
      name,
      qualityRating,
      qualityNote: typeof qualityNote === "string" ? qualityNote : null,
      easeOfUseRating,
      easeOfUseNote: typeof easeOfUseNote === "string" ? easeOfUseNote : null,
    });
  } catch (err) {
    if (err instanceof DuplicateManufacturerNameError || err instanceof InvalidRatingError) {
      return { error: err.message };
    }
    throw err;
  }

  revalidatePath("/manufacturers");
  redirect(`/manufacturers/${manufacturer.id}`);
}
