"use client";

import { useActionState } from "react";
import { deleteShipmentAction } from "./actions";

export function DeleteShipmentButton({ shipmentId }: { shipmentId: string }) {
  const [state, formAction, pending] = useActionState(
    deleteShipmentAction.bind(null, shipmentId),
    undefined
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
      >
        {pending ? "Deleting..." : "Delete Shipment"}
      </button>
    </form>
  );
}
