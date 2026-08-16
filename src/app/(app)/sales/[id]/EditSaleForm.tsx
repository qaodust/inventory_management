"use client";

import { useActionState } from "react";
import { SaleRouteField } from "@/components/SaleRouteField";
import { editSaleAction } from "./actions";

export function EditSaleForm({
  saleId,
  routes,
  quantity,
  pricePerUnit,
  saleRouteId,
}: {
  saleId: string;
  routes: { id: string; name: string }[];
  quantity: number;
  pricePerUnit: string;
  saleRouteId: string;
}) {
  const [state, formAction, pending] = useActionState(
    editSaleAction.bind(null, saleId),
    undefined
  );

  return (
    <form
      action={formAction}
      className="flex w-full flex-col gap-4 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="quantity" className="text-sm font-medium">
          Quantity
        </label>
        <input
          id="quantity"
          name="quantity"
          type="number"
          min="1"
          step="1"
          required
          defaultValue={quantity}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="pricePerUnit" className="text-sm font-medium">
          Price per unit
        </label>
        <input
          id="pricePerUnit"
          name="pricePerUnit"
          type="number"
          min="0"
          step="0.01"
          required
          defaultValue={pricePerUnit}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      <SaleRouteField routes={routes} defaultRouteId={saleRouteId} />

      {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-600 dark:text-green-400">Saved — FIFO allocations recalculated.</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {pending ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
