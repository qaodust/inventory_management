"use client";

import { useActionState, useState } from "react";
import { adjustInventoryAction } from "./actions";

const REASON_LABELS: Record<string, string> = {
  DAMAGE: "Damage",
  LOSS: "Loss",
  SAMPLE: "Sample",
  RETURN: "Return",
  COUNT_CORRECTION: "Count Correction",
  OTHER: "Other",
};

export function AdjustInventoryForm({
  productId,
  shipmentId,
  currentRemaining,
  quantityOrdered,
  today,
}: {
  productId: string;
  shipmentId: string;
  currentRemaining: number;
  quantityOrdered: number;
  today: string;
}) {
  const [state, formAction, pending] = useActionState(
    adjustInventoryAction.bind(null, productId, shipmentId),
    undefined
  );
  const [quantityDelta, setQuantityDelta] = useState("");
  const [reason, setReason] = useState("");

  const parsedDelta = Number.parseInt(quantityDelta, 10);
  const resulting = Number.isFinite(parsedDelta) ? currentRemaining + parsedDelta : currentRemaining;
  const outOfRange = resulting < 0 || resulting > quantityOrdered;

  return (
    <form
      action={formAction}
      className="flex w-full flex-col gap-4 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800"
    >
      <div className="rounded-md bg-neutral-50 p-3 text-sm dark:bg-neutral-900">
        <p>
          Current remaining: <span className="font-medium">{currentRemaining}</span>
        </p>
        <p className={outOfRange ? "text-red-600 dark:text-red-400" : ""}>
          Resulting: <span className="font-medium">{resulting}</span>
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="quantityDelta" className="text-sm font-medium">
          Quantity change
        </label>
        <input
          id="quantityDelta"
          name="quantityDelta"
          type="number"
          step="1"
          required
          value={quantityDelta}
          onChange={(e) => setQuantityDelta(e.target.value)}
          placeholder="e.g. -2 for damage, 1 to restore"
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="reason" className="text-sm font-medium">
          Reason
        </label>
        <select
          id="reason"
          name="reason"
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="" disabled>
            Select a reason
          </option>
          {Object.entries(REASON_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="note" className="text-sm font-medium">
          Note {reason === "OTHER" && <span className="text-neutral-400">(required)</span>}
        </label>
        <textarea
          id="note"
          name="note"
          required={reason === "OTHER"}
          rows={3}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="effectiveDate" className="text-sm font-medium">
          Effective Date
        </label>
        <input
          id="effectiveDate"
          name="effectiveDate"
          type="date"
          required
          defaultValue={today}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending || outOfRange}
        className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {pending ? "Saving..." : "Save Adjustment"}
      </button>
    </form>
  );
}
