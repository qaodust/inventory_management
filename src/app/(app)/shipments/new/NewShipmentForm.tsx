"use client";

import { useActionState } from "react";
import { createShipmentAction } from "./actions";

export function NewShipmentForm({
  manufacturers,
  products,
  today,
}: {
  manufacturers: { id: string; name: string }[];
  products: { id: string; name: string }[];
  today: string;
}) {
  const [state, formAction, pending] = useActionState(createShipmentAction, undefined);

  return (
    <form
      action={formAction}
      className="flex w-full max-w-lg flex-col gap-4 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="manufacturerId" className="text-sm font-medium">
          Manufacturer
        </label>
        <select
          id="manufacturerId"
          name="manufacturerId"
          required
          defaultValue=""
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="" disabled>
            Select a manufacturer
          </option>
          {manufacturers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="productId" className="text-sm font-medium">
          Product
        </label>
        <select
          id="productId"
          name="productId"
          required
          defaultValue=""
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="" disabled>
            Select a product
          </option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="quantityOrdered" className="text-sm font-medium">
          Quantity
        </label>
        <input
          id="quantityOrdered"
          name="quantityOrdered"
          type="number"
          min="1"
          step="1"
          required
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="productCost" className="text-sm font-medium">
          Product Cost
        </label>
        <input
          id="productCost"
          name="productCost"
          type="number"
          min="0"
          step="0.01"
          required
          placeholder="0.00"
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="shippingFee" className="text-sm font-medium">
          Shipping Fee
        </label>
        <input
          id="shippingFee"
          name="shippingFee"
          type="number"
          min="0"
          step="0.01"
          required
          placeholder="0.00"
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="orderDate" className="text-sm font-medium">
          Order Date
        </label>
        <input
          id="orderDate"
          name="orderDate"
          type="date"
          required
          defaultValue={today}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="expectedArrivalDate" className="text-sm font-medium">
          Expected Arrival Date <span className="text-neutral-400">(optional)</span>
        </label>
        <input
          id="expectedArrivalDate"
          name="expectedArrivalDate"
          type="date"
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {pending ? "Logging..." : "Log Shipment"}
      </button>
    </form>
  );
}
