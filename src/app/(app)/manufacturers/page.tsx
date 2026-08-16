import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/money";
import { computeManufacturerStats } from "@/lib/metrics";

function formatRating(rating: number | null): string {
  return rating === null ? "Not rated" : `${rating}/5`;
}

function formatDeliveryDays(avgDeliveryDays: number | null): string {
  return avgDeliveryDays === null ? "No arrivals yet" : `${avgDeliveryDays.toFixed(1)} days`;
}

function formatShippingFee(avgShippingFeeCents: number | null): string {
  return avgShippingFeeCents === null ? "No shipments yet" : formatCents(avgShippingFeeCents);
}

export default async function ManufacturersPage() {
  const manufacturers = await prisma.manufacturer.findMany({
    orderBy: { name: "asc" },
  });
  const stats = await Promise.all(
    manufacturers.map((m) => computeManufacturerStats(prisma, m.id))
  );
  const statsById = new Map(manufacturers.map((m, i) => [m.id, stats[i]]));

  return (
    <div className="flex flex-col gap-4 pb-16 md:pb-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Manufacturers</h1>
        <Link
          href="/manufacturers/new"
          className="hidden rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 md:inline-block dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Add Manufacturer
        </Link>
      </div>

      {manufacturers.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          No manufacturers yet. Add one to get started.
        </p>
      ) : (
        <>
          {/* PC: table */}
          <div className="hidden overflow-hidden rounded-lg border border-neutral-200 md:block dark:border-neutral-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Quality</th>
                  <th className="px-4 py-2 font-medium">Ease of Use</th>
                  <th className="px-4 py-2 font-medium">Avg Delivery Time</th>
                  <th className="px-4 py-2 font-medium">Avg Shipping Fee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {manufacturers.map((m) => {
                  const s = statsById.get(m.id)!;
                  return (
                    <tr
                      key={m.id}
                      className="cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900"
                    >
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/manufacturers/${m.id}`} className="block">
                          {m.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{formatRating(m.qualityRating)}</td>
                      <td className="px-4 py-3">{formatRating(m.easeOfUseRating)}</td>
                      <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">
                        {formatDeliveryDays(s.avgDeliveryDays)}
                      </td>
                      <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">
                        {formatShippingFee(s.avgShippingFeeCents)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <div className="flex flex-col gap-2 md:hidden">
            {manufacturers.map((m) => {
              const s = statsById.get(m.id)!;
              return (
                <Link
                  key={m.id}
                  href={`/manufacturers/${m.id}`}
                  className="flex flex-col gap-1 rounded-lg border border-neutral-200 p-4 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
                >
                  <span className="font-medium">{m.name}</span>
                  <span className="text-sm text-neutral-500 dark:text-neutral-400">
                    Quality: {formatRating(m.qualityRating)} · Ease of Use:{" "}
                    {formatRating(m.easeOfUseRating)}
                  </span>
                  <span className="text-sm text-neutral-500 dark:text-neutral-400">
                    {formatDeliveryDays(s.avgDeliveryDays)} avg delivery ·{" "}
                    {formatShippingFee(s.avgShippingFeeCents)} avg shipping
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      )}

      <Link
        href="/manufacturers/new"
        className="fixed right-4 bottom-20 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900 text-2xl font-medium text-white shadow-lg hover:bg-neutral-800 md:hidden dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        aria-label="Add Manufacturer"
      >
        +
      </Link>
    </div>
  );
}
