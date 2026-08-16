/** Sentinel <select> value for the sale form's inline "add new route" option. */
export const NEW_ROUTE_VALUE = "__new__";

export interface ParsedSaleRouteField {
  saleRouteId: string | null;
  newSaleRouteName: string | null;
}

/** Parses the SaleRouteField's <select>+<input> pair from FormData. */
export function parseSaleRouteField(formData: FormData): ParsedSaleRouteField {
  const raw = formData.get("saleRouteId");
  if (typeof raw !== "string" || raw === "") {
    return { saleRouteId: null, newSaleRouteName: null };
  }
  if (raw === NEW_ROUTE_VALUE) {
    const newSaleRouteName = formData.get("newSaleRouteName");
    return {
      saleRouteId: null,
      newSaleRouteName: typeof newSaleRouteName === "string" ? newSaleRouteName : null,
    };
  }
  return { saleRouteId: raw, newSaleRouteName: null };
}
