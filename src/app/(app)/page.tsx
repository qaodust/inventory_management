import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { decimalToCents, formatCents } from "@/lib/money";
import { resolveDateRangeParam, utcDateToDateString } from "@/lib/dates";
import { computeDashboardStats } from "@/lib/metrics";
import { getPendingDeliveries } from "@/lib/shipments";
import { DateRangeFilter } from "@/components/DateRangeFilter";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { range, from, to } = await searchParams;
  const dateRange = resolveDateRangeParam(range, from, to);

  const [stats, pendingDeliveries, recentSales] = await Promise.all([
    computeDashboardStats(prisma, dateRange),
    getPendingDeliveries(prisma),
    prisma.sale.findMany({
      take: 5,
      orderBy: [{ saleDate: "desc" }, { id: "desc" }],
      include: {
        product: { select: { name: true } },
        saleRoute: { select: { name: true } },
      },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6 pb-16 md:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Suspense>
          <DateRangeFilter />
        </Suspense>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/sales"
          className="rounded-md bg-neutral-900 px-4 py-3 text-center text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Log a Sale
        </Link>
        <Link
          href="/shipments/new"
          className="rounded-md border border-neutral-300 px-4 py-3 text-center text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Log a Shipment
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Total Profit</p>
          <p
            className={`mt-1 text-lg font-semibold ${
              stats.totalProfitCents < 0 ? "text-red-600 dark:text-red-400" : ""
            }`}
          >
            {formatCents(stats.totalProfitCents)}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Total Revenue</p>
          <p className="mt-1 text-lg font-semibold">{formatCents(stats.totalRevenueCents)}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Units Sold</p>
          <p className="mt-1 text-lg font-semibold">{stats.unitsSold}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Active Batches</p>
          <p className="mt-1 text-lg font-semibold">{stats.activeBatches}</p>
        </div>
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <div className="w-full rounded-lg border border-neutral-200 p-4 md:w-1/2 dark:border-neutral-800">
          <h2 className="mb-2 text-sm font-medium">Pending Deliveries</h2>
          {pendingDeliveries.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">No pending deliveries.</p>
          ) : (
            <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {pendingDeliveries.map((d) => (
                <li key={d.id} className="py-2 text-sm">
                  <Link href={`/shipments/${d.id}`} className="flex justify-between hover:underline">
                    <span>
                      {d.productName} · Qty {d.quantityOrdered}
                    </span>
                    <span className="text-neutral-500 dark:text-neutral-400">
                      {d.manufacturerName} · Ordered {utcDateToDateString(d.orderDate)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="w-full rounded-lg border border-neutral-200 p-4 md:w-1/2 dark:border-neutral-800">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium">Recent Sales</h2>
            <Link
              href="/sales/history"
              className="text-sm text-neutral-600 hover:underline dark:text-neutral-400"
            >
              View all
            </Link>
          </div>
          {recentSales.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">No sales logged yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {recentSales.map((s) => (
                <li key={s.id} className="py-2 text-sm">
                  <Link href={`/sales/${s.id}`} className="flex justify-between hover:underline">
                    <span>
                      {s.product.name} · Qty {s.quantity} · {formatCents(decimalToCents(s.pricePerUnit))}
                    </span>
                    <span className="text-neutral-500 dark:text-neutral-400">
                      {s.saleRoute.name} · {utcDateToDateString(s.saleDate)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
