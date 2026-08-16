"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function SalesHistoryFilters({
  products,
  routes,
}: {
  products: { id: string; name: string }[];
  routes: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedProduct = searchParams.get("product") ?? "";
  const selectedRoute = searchParams.get("route") ?? "";
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
        aria-label="Filter by product"
        value={selectedProduct}
        onChange={(e) =>
          updateParams((params) => {
            if (e.target.value) params.set("product", e.target.value);
            else params.delete("product");
          })
        }
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      >
        <option value="">All products</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by route"
        value={selectedRoute}
        onChange={(e) =>
          updateParams((params) => {
            if (e.target.value) params.set("route", e.target.value);
            else params.delete("route");
          })
        }
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      >
        <option value="">All routes</option>
        {routes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>

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
    </div>
  );
}
