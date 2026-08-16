"use client";

import { useActionState } from "react";
import { editManufacturerAction } from "./actions";
import { RatingSelect } from "@/components/RatingSelect";

export function EditManufacturerForm({
  manufacturerId,
  name,
  qualityRating,
  qualityNote,
  easeOfUseRating,
  easeOfUseNote,
}: {
  manufacturerId: string;
  name: string;
  qualityRating: number | null;
  qualityNote: string | null;
  easeOfUseRating: number | null;
  easeOfUseNote: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    editManufacturerAction.bind(null, manufacturerId),
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

      <div className="flex flex-col gap-1">
        <label htmlFor="qualityRating" className="text-sm font-medium">
          Quality rating
        </label>
        <RatingSelect id="qualityRating" name="qualityRating" defaultValue={qualityRating} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="qualityNote" className="text-sm font-medium">
          Quality note
        </label>
        <textarea
          id="qualityNote"
          name="qualityNote"
          rows={2}
          defaultValue={qualityNote ?? ""}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="easeOfUseRating" className="text-sm font-medium">
          Ease-of-use rating
        </label>
        <RatingSelect
          id="easeOfUseRating"
          name="easeOfUseRating"
          defaultValue={easeOfUseRating}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="easeOfUseNote" className="text-sm font-medium">
          Ease-of-use note
        </label>
        <textarea
          id="easeOfUseNote"
          name="easeOfUseNote"
          rows={2}
          defaultValue={easeOfUseNote ?? ""}
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
