/** Sentinel <select> value for the product form's inline "add new category" option. */
export const NEW_CATEGORY_VALUE = "__new__";

export interface ParsedCategoryField {
  categoryId: string | null;
  newCategoryName: string | null;
}

/** Parses the CategoryField's <select>+<input> pair from FormData. */
export function parseCategoryField(formData: FormData): ParsedCategoryField {
  const raw = formData.get("categoryId");
  if (typeof raw !== "string" || raw === "") {
    return { categoryId: null, newCategoryName: null };
  }
  if (raw === NEW_CATEGORY_VALUE) {
    const newCategoryName = formData.get("newCategoryName");
    return {
      categoryId: null,
      newCategoryName: typeof newCategoryName === "string" ? newCategoryName : null,
    };
  }
  return { categoryId: raw, newCategoryName: null };
}
