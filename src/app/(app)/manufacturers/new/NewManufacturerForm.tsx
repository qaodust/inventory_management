"use client";

import { useActionState } from "react";
import { createManufacturerAction } from "./actions";
import { RatingSelect } from "@/components/RatingSelect";

export function NewManufacturerForm() {
  const [state, formAction, pending] = useActionState(
    createManufacturerAction,
    undefined
  );

  return (
    <form
      action={formAction}
      className="flex w-full max-w-lg flex-col gap-4 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800"
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
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="qualityRating" className="text-sm font-medium">
          Quality rating
        </label>
        <RatingSelect id="qualityRating" name="qualityRating" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="qualityNote" className="text-sm font-medium">
          Quality note
        </label>
        <textarea
          id="qualityNote"
          name="qualityNote"
          rows={2}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="easeOfUseRating" className="text-sm font-medium">
          Ease-of-use rating
        </label>
        <RatingSelect id="easeOfUseRating" name="easeOfUseRating" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="easeOfUseNote" className="text-sm font-medium">
          Ease-of-use note
        </label>
        <textarea
          id="easeOfUseNote"
          name="easeOfUseNote"
          rows={2}
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
        {pending ? "Adding..." : "Add Manufacturer"}
      </button>
    </form>
  );
}
