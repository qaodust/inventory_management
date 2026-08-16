import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { decimalToCents, formatCents } from "@/lib/money";
import { nyDateStringToUtcDate, utcDateToDateString } from "@/lib/dates";
import { saleProfitCents } from "@/lib/sales";
import { SalesHistoryFilters } from "./SalesHistoryFilters";

export default async function SalesHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; route?: string; from?: string; to?: string }>;
}) {
  const { product, route, from, to } = await searchParams;

  const [sales, products, routes] = await Promise.all([
    prisma.sale.findMany({
      where: {
        productId: product || undefined,
        saleRouteId: route || undefined,
        saleDate: {
          gte: from ? nyDateStringToUtcDate(from) : undefined,
          lte: to ? nyDateStringToUtcDate(to) : undefined,
        },
      },
      include: {
        product: { select: { name: true } },
        saleRoute: { select: { name: true } },
        allocations: { select: { costBasisCents: true } },
      },
      orderBy: [{ saleDate: "desc" }, { id: "desc" }],
    }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.saleRoute.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-4 pb-16 md:pb-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sales History</h1>
        <Link
          href="/sales"
          className="text-sm font-medium text-neutral-600 hover:underline dark:text-neutral-400"
        >
          Log Sale
        </Link>
      </div>

      <Suspense>
        <SalesHistoryFilters products={products} routes={routes} />
      </Suspense>

      {sales.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">No sales found.</p>
      ) : (
        <>
          {/* PC: table */}
          <div className="hidden overflow-hidden rounded-lg border border-neutral-200 md:block dark:border-neutral-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Product</th>
                  <th className="px-4 py-2 font-medium">Qty</th>
                  <th className="px-4 py-2 font-medium">Price/Unit</th>
                  <th className="px-4 py-2 font-medium">Route</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {sales.map((s) => {
                  const profitCents = saleProfitCents(s);
                  return (
                    <tr key={s.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900">
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/sales/${s.id}`} className="block">
                          {s.product.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{s.quantity}</td>
                      <td className="px-4 py-3">{formatCents(decimalToCents(s.pricePerUnit))}</td>
                      <td className="px-4 py-3">{s.saleRoute.name}</td>
                      <td className="px-4 py-3">{utcDateToDateString(s.saleDate)}</td>
                      <td className="px-4 py-3">
                        <span className={profitCents < 0 ? "text-red-600 dark:text-red-400" : ""}>
                          {formatCents(profitCents)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <div className="flex flex-col gap-2 md:hidden">
            {sales.map((s) => {
              const profitCents = saleProfitCents(s);
              return (
                <Link
                  key={s.id}
                  href={`/sales/${s.id}`}
                  className="flex flex-col gap-1 rounded-lg border border-neutral-200 p-4 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
                >
                  <span className="font-medium">{s.product.name}</span>
                  <span className="text-sm text-neutral-500 dark:text-neutral-400">
                    Qty {s.quantity} · {s.saleRoute.name} · {utcDateToDateString(s.saleDate)}
                  </span>
                  <span className="text-sm">
                    Profit:{" "}
                    <span className={profitCents < 0 ? "text-red-600 dark:text-red-400" : "font-medium"}>
                      {formatCents(profitCents)}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
