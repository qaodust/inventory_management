import Link from "next/link";
import { Suspense } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { decimalToCents, formatCents } from "@/lib/money";
import { ProductFilters } from "./ProductFilters";

function formatGoalPrice(goalPrice: Prisma.Decimal | null): string {
  return goalPrice === null ? "—" : formatCents(decimalToCents(goalPrice));
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; archived?: string }>;
}) {
  const { category, archived } = await searchParams;
  const showArchived = archived === "1";

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: {
        categoryId: category || undefined,
        hidden: showArchived ? undefined : false,
      },
      include: { category: true },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-4 pb-16 md:pb-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Products</h1>
        <Link
          href="/products/new"
          className="hidden rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 md:inline-block dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Add Product
        </Link>
      </div>

      <Suspense>
        <ProductFilters categories={categories} />
      </Suspense>

      {products.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          No products {showArchived ? "" : "(non-archived) "}yet.
        </p>
      ) : (
        <>
          {/* PC: table */}
          <div className="hidden overflow-hidden rounded-lg border border-neutral-200 md:block dark:border-neutral-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium">Goal Price</th>
                  <th className="px-4 py-2 font-medium">Qty Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {products.map((p) => (
                  <tr
                    key={p.id}
                    className="cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900"
                  >
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/products/${p.id}`} className="block">
                        {p.name}
                        {p.hidden && (
                          <span className="ml-2 rounded bg-neutral-200 px-1.5 py-0.5 text-xs font-normal text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                            Archived
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{p.category?.name ?? "—"}</td>
                    <td className="px-4 py-3">{formatGoalPrice(p.goalPrice)}</td>
                    <td className="px-4 py-3">0</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <div className="flex flex-col gap-2 md:hidden">
            {products.map((p) => (
              <Link
                key={p.id}
                href={`/products/${p.id}`}
                className="flex flex-col gap-1 rounded-lg border border-neutral-200 p-4 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
              >
                <span className="font-medium">
                  {p.name}
                  {p.hidden && (
                    <span className="ml-2 rounded bg-neutral-200 px-1.5 py-0.5 text-xs font-normal text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                      Archived
                    </span>
                  )}
                </span>
                <span className="text-sm text-neutral-500 dark:text-neutral-400">
                  {p.category?.name ?? "No category"} · {formatGoalPrice(p.goalPrice)} goal · 0
                  available
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      <Link
        href="/products/new"
        className="fixed right-4 bottom-20 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900 text-2xl font-medium text-white shadow-lg hover:bg-neutral-800 md:hidden dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        aria-label="Add Product"
      >
        +
      </Link>
    </div>
  );
}
