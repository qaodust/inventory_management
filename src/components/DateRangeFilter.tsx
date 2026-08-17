"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const RANGE_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
  { value: "custom", label: "Custom" },
] as const;

export function DateRangeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const range = searchParams.get("range") ?? "all";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  function updateParams(update: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    update(params);
    router.push(params.size > 0 ? `${pathname}?${params.toString()}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        aria-label="Date range"
        value={range}
        onChange={(e) =>
          updateParams((params) => {
            if (e.target.value === "all") params.delete("range");
            else params.set("range", e.target.value);
            if (e.target.value !== "custom") {
              params.delete("from");
              params.delete("to");
            }
          })
        }
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      >
        {RANGE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {range === "custom" && (
        <>
          <input
            type="date"
            aria-label="From date"
            value={from}
            onChange={(e) =>
              updateParams((params) => {
                if (e.target.value) params.set("from", e.target.value);
                else params.delete("from");
              })
            }
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
          <span className="text-sm text-neutral-500 dark:text-neutral-400">to</span>
          <input
            type="date"
            aria-label="To date"
            value={to}
            onChange={(e) =>
              updateParams((params) => {
                if (e.target.value) params.set("to", e.target.value);
                else params.delete("to");
              })
            }
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
        </>
      )}
    </div>
  );
}
