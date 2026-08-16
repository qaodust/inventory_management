"use client";

import { useActionState } from "react";
import { editProductAction } from "./actions";
import { CategoryField } from "@/components/CategoryField";

export function EditProductForm({
  productId,
  name,
  goalPrice,
  categoryId,
  categories,
}: {
  productId: string;
  name: string;
  goalPrice: string;
  categoryId: string | null;
  categories: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    editProductAction.bind(null, productId),
    undefined
  );

  return (
    <form
      action={formAction}
      className="flex w-full flex-col gap-4 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={name}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      <CategoryField categories={categories} defaultCategoryId={categoryId} />

      <div className="flex flex-col gap-1">
        <label htmlFor="goalPrice" className="text-sm font-medium">
          Goal price
        </label>
        <input
          id="goalPrice"
          name="goalPrice"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          defaultValue={goalPrice}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-sm text-green-600 dark:text-green-400">Saved.</p>
      )}

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
