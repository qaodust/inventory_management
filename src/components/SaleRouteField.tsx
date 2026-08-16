"use client";

import { useState } from "react";
import { NEW_ROUTE_VALUE } from "@/lib/actions/sale-route-field";

/**
 * Sale route <select> + inline "add new route" text field — routes are
 * an extensible user-managed list, so adding one must never require a
 * deployment or a separate screen.
 */
export function SaleRouteField({
  routes,
  defaultRouteId,
}: {
  routes: { id: string; name: string }[];
  defaultRouteId?: string;
}) {
  const [selected, setSelected] = useState(defaultRouteId ?? "");

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="saleRouteId" className="text-sm font-medium">
        Sale Route
      </label>
      <select
        id="saleRouteId"
        name="saleRouteId"
        required
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      >
        <option value="" disabled>
          Select a route
        </option>
        {routes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
        <option value={NEW_ROUTE_VALUE}>+ Add new route…</option>
      </select>
      {selected === NEW_ROUTE_VALUE && (
        <input
          type="text"
          name="newSaleRouteName"
          placeholder="New route name"
          required
          autoFocus
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      )}
    </div>
  );
}
