import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/money";
import { resolveDateRangeParam } from "@/lib/dates";
import {
  computeManufacturerReport,
  computeOverviewReport,
  computeProductReport,
  computeRouteReport,
  sortReportRows,
  type ManufacturerReportRow,
  type ProductReportRow,
  type RouteReportRow,
} from "@/lib/reports";
import { DateRangeFilter } from "@/components/DateRangeFilter";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "product", label: "By Product" },
  { value: "manufacturer", label: "By Manufacturer" },
  { value: "route", label: "By Route" },
] as const;
type TabValue = (typeof TABS)[number]["value"];

function formatDays(days: number | null): string {
  return days === null ? "—" : `${days.toFixed(1)} days`;
}

function formatRating(rating: number | null): string {
  return rating === null ? "—" : `${rating} / 5`;
}

function profitClass(cents: number): string {
  return cents < 0 ? "text-red-600 dark:text-red-400" : "";
}

interface ReportsSearchParams {
  tab?: string;
  range?: string;
  from?: string;
  to?: string;
  sort?: string;
  dir?: string;
}

function buildHref(current: ReportsSearchParams, overrides: Partial<ReportsSearchParams>): string {
  const merged = { ...current, ...overrides };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `/reports?${qs}` : "/reports";
}

function SortableHeader({
  label,
  sortKey,
  current,
  className,
}: {
  label: string;
  sortKey: string;
  current: ReportsSearchParams;
  className?: string;
}) {
  const isActive = current.sort === sortKey || (!current.sort && sortKey === "profit");
  const nextDir = isActive && current.dir !== "asc" ? "asc" : "desc";
  return (
    <th className={`px-4 py-2 font-medium ${className ?? ""}`}>
      <Link href={buildHref(current, { sort: sortKey, dir: nextDir })} className="hover:underline">
        {label}
        {isActive ? (current.dir === "asc" ? " ▲" : " ▼") : ""}
      </Link>
    </th>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<ReportsSearchParams>;
}) {
  const params = await searchParams;
  const activeTab: TabValue = TABS.some((t) => t.value === params.tab) ? (params.tab as TabValue) : "overview";
  const range = resolveDateRangeParam(params.range, params.from, params.to);
  const dir: "asc" | "desc" = params.dir === "asc" ? "asc" : "desc";

  return (
    <div className="flex flex-col gap-4 pb-16 md:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <Suspense>
          <DateRangeFilter />
        </Suspense>
      </div>

      <div className="flex gap-4 overflow-x-auto border-b border-neutral-200 dark:border-neutral-800">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={buildHref(params, { tab: t.value, sort: undefined, dir: undefined })}
            className={`whitespace-nowrap border-b-2 px-1 pb-2 text-sm font-medium ${
              activeTab === t.value
                ? "border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100"
                : "border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {activeTab === "overview" && <OverviewTab range={range} />}
      {activeTab === "product" && <ProductTab range={range} current={{ ...params, tab: "product" }} dir={dir} />}
      {activeTab === "manufacturer" && (
        <ManufacturerTab range={range} current={{ ...params, tab: "manufacturer" }} dir={dir} />
      )}
      {activeTab === "route" && <RouteTab range={range} current={{ ...params, tab: "route" }} dir={dir} />}
    </div>
  );
}

async function OverviewTab({ range }: { range: { from: Date; to: Date } | null }) {
  const stats = await computeOverviewReport(prisma, range);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Total Profit</p>
        <p className={`mt-1 text-lg font-semibold ${profitClass(stats.totalProfitCents)}`}>
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
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Avg Sell-Through Time</p>
        <p className="mt-1 text-lg font-semibold">{formatDays(stats.avgSellThroughDays)}</p>
      </div>
    </div>
  );
}

async function ProductTab({
  range,
  current,
  dir,
}: {
  range: { from: Date; to: Date } | null;
  current: ReportsSearchParams;
  dir: "asc" | "desc";
}) {
  const rows = await computeProductReport(prisma, range);
  const accessors: Record<string, (r: ProductReportRow) => number | null> = {
    profit: (r) => r.profitCents,
    units: (r) => r.unitsSold,
    sellThrough: (r) => r.avgSellThroughDays,
  };
  const sortKey = current.sort && current.sort in accessors ? current.sort : "profit";
  const sorted = sortReportRows(rows, accessors[sortKey], dir);

  if (sorted.length === 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">No product activity in this range.</p>;
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border border-neutral-200 md:block dark:border-neutral-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-2 font-medium">Product</th>
              <SortableHeader label="Profit" sortKey="profit" current={current} />
              <SortableHeader label="Units Sold" sortKey="units" current={current} />
              <SortableHeader label="Avg Sell-Through" sortKey="sellThrough" current={current} />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {sorted.map((r) => (
              <tr key={r.productId}>
                <td className="px-4 py-3 font-medium">
                  <Link href={`/products/${r.productId}`} className="hover:underline">
                    {r.productName}
                  </Link>
                </td>
                <td className={`px-4 py-3 ${profitClass(r.profitCents)}`}>{formatCents(r.profitCents)}</td>
                <td className="px-4 py-3">{r.unitsSold}</td>
                <td className="px-4 py-3">{formatDays(r.avgSellThroughDays)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 md:hidden">
        {sorted.map((r) => (
          <Link
            key={r.productId}
            href={`/products/${r.productId}`}
            className="flex flex-col gap-1 rounded-lg border border-neutral-200 p-4 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
          >
            <span className="font-medium">{r.productName}</span>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              {r.unitsSold} units · {formatDays(r.avgSellThroughDays)} sell-through
            </span>
            <span className={`text-sm font-medium ${profitClass(r.profitCents)}`}>
              {formatCents(r.profitCents)} profit
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}

async function ManufacturerTab({
  range,
  current,
  dir,
}: {
  range: { from: Date; to: Date } | null;
  current: ReportsSearchParams;
  dir: "asc" | "desc";
}) {
  const rows = await computeManufacturerReport(prisma, range);
  const accessors: Record<string, (r: ManufacturerReportRow) => number | null> = {
    profit: (r) => r.profitCents,
    delivery: (r) => r.avgDeliveryDays,
    shipping: (r) => r.avgShippingFeeCents,
    quality: (r) => r.qualityRating,
    ease: (r) => r.easeOfUseRating,
    reliability: (r) => (r.reliability.status === "ok" ? r.reliability.onTimePct : null),
  };
  const sortKey = current.sort && current.sort in accessors ? current.sort : "profit";
  const sorted = sortReportRows(rows, accessors[sortKey], dir);

  if (sorted.length === 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">No manufacturers yet.</p>;
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border border-neutral-200 md:block dark:border-neutral-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-2 font-medium">Manufacturer</th>
              <SortableHeader label="Profit" sortKey="profit" current={current} />
              <SortableHeader label="Avg Delivery" sortKey="delivery" current={current} />
              <SortableHeader label="Avg Shipping Fee" sortKey="shipping" current={current} />
              <SortableHeader label="Quality" sortKey="quality" current={current} />
              <SortableHeader label="Ease of Use" sortKey="ease" current={current} />
              <SortableHeader label="Reliability" sortKey="reliability" current={current} />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {sorted.map((r) => (
              <tr key={r.manufacturerId}>
                <td className="px-4 py-3 font-medium">
                  <Link href={`/manufacturers/${r.manufacturerId}`} className="hover:underline">
                    {r.manufacturerName}
                  </Link>
                </td>
                <td className={`px-4 py-3 ${profitClass(r.profitCents)}`}>{formatCents(r.profitCents)}</td>
                <td className="px-4 py-3">{formatDays(r.avgDeliveryDays)}</td>
                <td className="px-4 py-3">
                  {r.avgShippingFeeCents === null ? "—" : formatCents(r.avgShippingFeeCents)}
                </td>
                <td className="px-4 py-3">{formatRating(r.qualityRating)}</td>
                <td className="px-4 py-3">{formatRating(r.easeOfUseRating)}</td>
                <td className="px-4 py-3">
                  {r.reliability.status === "ok" ? `${r.reliability.onTimePct.toFixed(0)}% on time` : "Not enough data"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 md:hidden">
        {sorted.map((r) => (
          <Link
            key={r.manufacturerId}
            href={`/manufacturers/${r.manufacturerId}`}
            className="flex flex-col gap-1 rounded-lg border border-neutral-200 p-4 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
          >
            <span className="font-medium">{r.manufacturerName}</span>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              {formatDays(r.avgDeliveryDays)} delivery ·{" "}
              {r.avgShippingFeeCents === null ? "— shipping" : `${formatCents(r.avgShippingFeeCents)} shipping`}
            </span>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              {r.reliability.status === "ok" ? `${r.reliability.onTimePct.toFixed(0)}% on time` : "Not enough data yet"}
            </span>
            <span className={`text-sm font-medium ${profitClass(r.profitCents)}`}>
              {formatCents(r.profitCents)} profit
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}

async function RouteTab({
  range,
  current,
  dir,
}: {
  range: { from: Date; to: Date } | null;
  current: ReportsSearchParams;
  dir: "asc" | "desc";
}) {
  const rows = await computeRouteReport(prisma, range);
  const accessors: Record<string, (r: RouteReportRow) => number | null> = {
    profit: (r) => r.totalProfitCents,
    units: (r) => r.unitsSold,
    perUnit: (r) => r.avgProfitPerUnitCents,
  };
  const sortKey = current.sort && current.sort in accessors ? current.sort : "profit";
  const sorted = sortReportRows(rows, accessors[sortKey], dir);

  if (sorted.length === 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">No sales in this range.</p>;
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border border-neutral-200 md:block dark:border-neutral-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-2 font-medium">Route</th>
              <SortableHeader label="Units Sold" sortKey="units" current={current} />
              <SortableHeader label="Avg Profit/Unit" sortKey="perUnit" current={current} />
              <SortableHeader label="Total Profit" sortKey="profit" current={current} />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {sorted.map((r) => (
              <tr key={r.routeId}>
                <td className="px-4 py-3 font-medium">{r.routeName}</td>
                <td className="px-4 py-3">{r.unitsSold}</td>
                <td className={`px-4 py-3 ${profitClass(r.avgProfitPerUnitCents)}`}>
                  {formatCents(r.avgProfitPerUnitCents)}
                </td>
                <td className={`px-4 py-3 ${profitClass(r.totalProfitCents)}`}>
                  {formatCents(r.totalProfitCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 md:hidden">
        {sorted.map((r) => (
          <div
            key={r.routeId}
            className="flex flex-col gap-1 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
          >
            <span className="font-medium">{r.routeName}</span>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              {r.unitsSold} units · {formatCents(r.avgProfitPerUnitCents)}/unit
            </span>
            <span className={`text-sm font-medium ${profitClass(r.totalProfitCents)}`}>
              {formatCents(r.totalProfitCents)} total profit
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
