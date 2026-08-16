/**
 * Parses a 1-5 rating <select> field from FormData. Empty string means
 * "not rated" (null); any other non-integer/out-of-range value is
 * rejected here so createManufacturer/editManufacturer only ever see a
 * clean null or an in-range integer.
 */
export function parseRatingField(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
    throw new Error(`Invalid rating: ${value}`);
  }
  return parsed;
}
