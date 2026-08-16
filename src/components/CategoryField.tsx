"use client";

import { useState } from "react";
import { NEW_CATEGORY_VALUE } from "@/lib/actions/category-field";

/**
 * Category <select> + inline "add new category" text field, shared by
 * the product add/edit forms — categories are a user-managed list, so
 * adding one must never require a deployment or a separate screen.
 */
export function CategoryField({
  categories,
  defaultCategoryId,
}: {
  categories: { id: string; name: string }[];
  defaultCategoryId?: string | null;
}) {
  const [selected, setSelected] = useState(defaultCategoryId ?? "");

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="categoryId" className="text-sm font-medium">
        Category
      </label>
      <select
        id="categoryId"
        name="categoryId"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      >
        <option value="">No category</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
        <option value={NEW_CATEGORY_VALUE}>+ Add new category…</option>
      </select>
      {selected === NEW_CATEGORY_VALUE && (
        <input
          type="text"
          name="newCategoryName"
          placeholder="New category name"
          required
          autoFocus
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      )}
    </div>
  );
}
