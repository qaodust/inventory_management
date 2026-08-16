import { Prisma, type PrismaClient } from "@/generated/prisma/client";

export class InvalidRatingError extends Error {
  constructor(field: string, value: number) {
    super(`${field} must be a whole number between 1 and 5, got ${value}.`);
    this.name = "InvalidRatingError";
  }
}

export class DuplicateManufacturerNameError extends Error {
  constructor(name: string) {
    super(`A manufacturer named "${name}" already exists.`);
    this.name = "DuplicateManufacturerNameError";
  }
}

function assertValidRating(field: string, value: number | null | undefined): void {
  if (value === null || value === undefined) return;
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new InvalidRatingError(field, value);
  }
}

/** Empty/whitespace-only notes are stored as null rather than an empty string. */
function normalizeNote(note: string | null | undefined): string | null | undefined {
  if (note === undefined) return undefined;
  if (note === null) return null;
  const trimmed = note.trim();
  return trimmed === "" ? null : trimmed;
}

export interface ManufacturerRatingInput {
  qualityRating?: number | null;
  qualityNote?: string | null;
  easeOfUseRating?: number | null;
  easeOfUseNote?: string | null;
}

export interface CreateManufacturerInput extends ManufacturerRatingInput {
  name: string;
}

export async function createManufacturer(
  prisma: PrismaClient,
  input: CreateManufacturerInput
) {
  const name = input.name.trim();
  if (!name) throw new Error("Manufacturer name is required.");
  assertValidRating("qualityRating", input.qualityRating);
  assertValidRating("easeOfUseRating", input.easeOfUseRating);

  try {
    return await prisma.manufacturer.create({
      data: {
        name,
        qualityRating: input.qualityRating ?? null,
        qualityNote: normalizeNote(input.qualityNote) ?? null,
        easeOfUseRating: input.easeOfUseRating ?? null,
        easeOfUseNote: normalizeNote(input.easeOfUseNote) ?? null,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new DuplicateManufacturerNameError(name);
    }
    throw err;
  }
}

export interface EditManufacturerInput extends ManufacturerRatingInput {
  name?: string;
}

export async function editManufacturer(
  prisma: PrismaClient,
  id: string,
  input: EditManufacturerInput
) {
  assertValidRating("qualityRating", input.qualityRating);
  assertValidRating("easeOfUseRating", input.easeOfUseRating);

  const name = input.name !== undefined ? input.name.trim() : undefined;
  if (name !== undefined && !name) throw new Error("Manufacturer name is required.");

  try {
    return await prisma.manufacturer.update({
      where: { id },
      data: {
        name,
        qualityRating: input.qualityRating,
        qualityNote: normalizeNote(input.qualityNote),
        easeOfUseRating: input.easeOfUseRating,
        easeOfUseNote: normalizeNote(input.easeOfUseNote),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new DuplicateManufacturerNameError(name as string);
    }
    throw err;
  }
}

/**
 * Minimum number of arrived shipments (with an expected arrival date on
 * file) before a reliability percentage is considered meaningful. 1/1
 * = "100% reliable" off a single shipment would be misleading; this is
 * a defensible floor, not a business-mandated number — tune freely.
 */
export const MIN_SHIPMENTS_FOR_RELIABILITY = 5;

export type ReliabilityResult =
  | { status: "insufficient-data"; sampleSize: number }
  | { status: "ok"; onTimePct: number; sampleSize: number };

/**
 * % of a manufacturer's arrived shipments that arrived on or before
 * their expected arrival date. Only shipments that have both actually
 * arrived and had an expected date on file count toward the sample —
 * a still-pending shipment isn't "late" yet, just not arrived.
 */
export async function computeReliability(
  prisma: PrismaClient,
  manufacturerId: string
): Promise<ReliabilityResult> {
  const shipments = await prisma.shipment.findMany({
    where: {
      manufacturerId,
      arrivalDate: { not: null },
      expectedArrivalDate: { not: null },
    },
    select: { arrivalDate: true, expectedArrivalDate: true },
  });

  if (shipments.length < MIN_SHIPMENTS_FOR_RELIABILITY) {
    return { status: "insufficient-data", sampleSize: shipments.length };
  }

  const onTime = shipments.filter((s) => s.arrivalDate! <= s.expectedArrivalDate!).length;
  return {
    status: "ok",
    onTimePct: (onTime / shipments.length) * 100,
    sampleSize: shipments.length,
  };
}
