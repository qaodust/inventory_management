"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function ProductFilters({
  categories,
}: {
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedCategory = searchParams.get("category") ?? "";
  const showArchived = searchParams.get("archived") === "1";

  function updateParams(update: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    update(params);
    router.push(params.size > 0 ? `${pathname}?${params.toString()}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        aria-label="Filter by category"
        value={selectedCategory}
        onChange={(e) =>
          updateParams((params) => {
            if (e.target.value) params.set("category", e.target.value);
            else params.delete("category");
          })
        }
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) =>
            updateParams((params) => {
              if (e.target.checked) params.set("archived", "1");
              else params.delete("archived");
            })
          }
          className="h-4 w-4"
        />
        Show archived
      </label>
    </div>
  );
}
