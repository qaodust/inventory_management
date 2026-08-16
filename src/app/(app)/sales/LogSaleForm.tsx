"use client";

import { useActionState, useMemo, useState } from "react";
import { SaleRouteField } from "@/components/SaleRouteField";
import { createSaleAction } from "./actions";

// Client-side display formatting only — must not import from "@/lib/money",
// which pulls in the generated Prisma client (Node-only) and breaks the
// client bundle. Never use this output as a stored or computed value.
function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export interface SellableProductBatch {
  remainingQty: number;
  costPerUnitCents: number;
  arrivalDate: string;
}

export interface SellableProduct {
  id: string;
  name: string;
  /** Goal price, dollars as a string (e.g. "12.50"), or null if unset. */
  goalPrice: string | null;
  /** Arrived batches with remaining stock, oldest-first — matches FIFO order. */
  batches: SellableProductBatch[];
}

interface PreviewResult {
  fulfilledQty: number;
  costCents: number;
  shortfall: number;
  batchDates: string[];
}

function previewFifoCost(batches: SellableProductBatch[], quantity: number): PreviewResult {
  let remaining = quantity;
  let costCents = 0;
  const batchDates: string[] = [];

  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(batch.remainingQty, remaining);
    if (take <= 0) continue;
    costCents += take * batch.costPerUnitCents;
    batchDates.push(batch.arrivalDate);
    remaining -= take;
  }

  return {
    fulfilledQty: quantity - remaining,
    costCents,
    shortfall: remaining,
    batchDates,
  };
}

export function LogSaleForm({
  products,
  routes,
}: {
  products: SellableProduct[];
  routes: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createSaleAction, undefined);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId),
    [products, productId]
  );

  function handleProductChange(newProductId: string) {
    setProductId(newProductId);
    const goalPrice = products.find((p) => p.id === newProductId)?.goalPrice;
    if (goalPrice) setPricePerUnit(goalPrice);
  }

  const totalAvailable = selectedProduct?.batches.reduce((sum, b) => sum + b.remainingQty, 0) ?? 0;

  const parsedQty = Number.parseInt(quantity, 10);
  const parsedPrice = Number.parseFloat(pricePerUnit);
  const hasValidInputs =
    !!selectedProduct && Number.isInteger(parsedQty) && parsedQty > 0 && Number.isFinite(parsedPrice);

  const preview = hasValidInputs ? previewFifoCost(selectedProduct.batches, parsedQty) : null;
  const revenueCents = hasValidInputs ? Math.round(parsedPrice * 100) * parsedQty : 0;
  const profitCents = preview ? revenueCents - preview.costCents : 0;
  const insufficientStock = preview !== null && preview.shortfall > 0;

  return (
    <form
      action={formAction}
      className="flex w-full max-w-lg flex-col gap-4 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="productId" className="text-sm font-medium">
          Product
        </label>
        <select
          id="productId"
          name="productId"
          required
          value={productId}
          onChange={(e) => handleProductChange(e.target.value)}
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
        {selectedProduct && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {totalAvailable} available
          </p>
        )}
      </div>

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
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
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
          placeholder="0.00"
          value={pricePerUnit}
          onChange={(e) => setPricePerUnit(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      <SaleRouteField routes={routes} />

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">Sale Date</span>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Today (auto-set on save)</p>
      </div>

      {hasValidInputs && (
        <div className="rounded-md bg-neutral-50 p-3 text-sm dark:bg-neutral-900">
          {insufficientStock ? (
            <p className="text-red-600 dark:text-red-400">
              Not enough stock — short by {preview!.shortfall} unit(s).
            </p>
          ) : (
            <>
              <p>
                Revenue: <span className="font-medium">{formatCents(revenueCents)}</span>
              </p>
              <p>
                Cost basis: <span className="font-medium">{formatCents(preview!.costCents)}</span>
              </p>
              <p>
                Profit:{" "}
                <span className={profitCents < 0 ? "text-red-600 dark:text-red-400" : "font-medium"}>
                  {formatCents(profitCents)}
                </span>
              </p>
              {preview!.batchDates.length > 0 && (
                <p className="mt-1 text-neutral-500 dark:text-neutral-400">
                  Drawing from batch{preview!.batchDates.length > 1 ? "es" : ""} arrived{" "}
                  {preview!.batchDates.join(", ")}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={pending || insufficientStock}
        className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {pending ? "Logging..." : "Log Sale"}
      </button>
    </form>
  );
}
