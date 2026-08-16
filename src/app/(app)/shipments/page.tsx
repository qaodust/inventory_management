import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { decimalToCents, formatCents } from "@/lib/money";
import { nyTodayDateString, utcDateToDateString } from "@/lib/dates";
import { markShipmentArrivedAction } from "./actions";

type Tab = "pending" | "arrived" | "all";

function tabWhere(tab: Tab) {
  if (tab === "pending") return { arrivalDate: null };
  if (tab === "arrived") return { arrivalDate: { not: null } };
  return {};
}

export default async function ShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: rawTab } = await searchParams;
  const tab: Tab = rawTab === "arrived" || rawTab === "all" ? rawTab : "pending";

  const shipments = await prisma.shipment.findMany({
    where: tabWhere(tab),
    include: { product: { select: { name: true } }, manufacturer: { select: { name: true } } },
    orderBy: [{ orderDate: "desc" }, { id: "desc" }],
  });

  const today = nyTodayDateString();

  const tabs: { key: Tab; label: string }[] = [
    { key: "pending", label: "Pending" },
    { key: "arrived", label: "Arrived" },
    { key: "all", label: "All" },
  ];

  return (
    <div className="flex flex-col gap-4 pb-16 md:pb-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Shipments</h1>
        <Link
          href="/shipments/new"
          className="hidden rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 md:inline-block dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Log New Shipment
        </Link>
      </div>

      <div className="flex gap-1 rounded-lg border border-neutral-200 p-1 dark:border-neutral-800 w-fit">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === "pending" ? "/shipments" : `/shipments?tab=${t.key}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === t.key
                ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {shipments.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          No {tab === "all" ? "" : tab} shipments yet.
        </p>
      ) : (
        <>
          {/* PC: table */}
          <div className="hidden overflow-hidden rounded-lg border border-neutral-200 md:block dark:border-neutral-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Product</th>
                  <th className="px-4 py-2 font-medium">Manufacturer</th>
                  <th className="px-4 py-2 font-medium">Qty</th>
                  <th className="px-4 py-2 font-medium">Product Cost</th>
                  <th className="px-4 py-2 font-medium">Shipping Fee</th>
                  <th className="px-4 py-2 font-medium">Total Cost</th>
                  <th className="px-4 py-2 font-medium">Order Date</th>
                  <th className="px-4 py-2 font-medium">Arrival Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {shipments.map((s) => {
                  const totalCents = decimalToCents(s.productCost) + decimalToCents(s.shippingFee);
                  return (
                    <tr key={s.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900">
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/shipments/${s.id}`} className="block">
                          {s.product.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{s.manufacturer.name}</td>
                      <td className="px-4 py-3">{s.quantityOrdered}</td>
                      <td className="px-4 py-3">{formatCents(decimalToCents(s.productCost))}</td>
                      <td className="px-4 py-3">{formatCents(decimalToCents(s.shippingFee))}</td>
                      <td className="px-4 py-3">{formatCents(totalCents)}</td>
                      <td className="px-4 py-3">{utcDateToDateString(s.orderDate)}</td>
                      <td className="px-4 py-3">
                        {s.arrivalDate ? (
                          utcDateToDateString(s.arrivalDate)
                        ) : (
                          <form
                            action={markShipmentArrivedAction.bind(null, s.id)}
                            className="flex items-center gap-2"
                          >
                            <input
                              type="date"
                              name="arrivalDate"
                              defaultValue={today}
                              className="rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                            />
                            <button
                              type="submit"
                              className="rounded-md bg-neutral-900 px-2 py-1 text-xs font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
                            >
                              Mark Arrived
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <div className="flex flex-col gap-2 md:hidden">
            {shipments.map((s) => {
              const totalCents = decimalToCents(s.productCost) + decimalToCents(s.shippingFee);
              return (
                <div
                  key={s.id}
                  className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
                >
                  <Link href={`/shipments/${s.id}`} className="flex flex-col gap-1">
                    <span className="font-medium">{s.product.name}</span>
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">
                      {s.manufacturer.name} · Qty {s.quantityOrdered}
                    </span>
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">
                      Total {formatCents(totalCents)} · Ordered {utcDateToDateString(s.orderDate)}
                    </span>
                  </Link>
                  {s.arrivalDate ? (
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">
                      Arrived {utcDateToDateString(s.arrivalDate)}
                    </span>
                  ) : (
                    <form
                      action={markShipmentArrivedAction.bind(null, s.id)}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="date"
                        name="arrivalDate"
                        defaultValue={today}
                        className="flex-1 rounded-md border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                      />
                      <button
                        type="submit"
                        className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
                      >
                        Mark Arrived
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <Link
        href="/shipments/new"
        className="fixed right-4 bottom-20 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900 text-2xl font-medium text-white shadow-lg hover:bg-neutral-800 md:hidden dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        aria-label="Log New Shipment"
      >
        +
      </Link>
    </div>
  );
}
