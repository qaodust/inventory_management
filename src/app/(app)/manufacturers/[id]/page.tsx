import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/money";
import { utcDateToDateString } from "@/lib/dates";
import { computeManufacturerStats } from "@/lib/metrics";
import { computeReliability } from "@/lib/manufacturers";
import { EditManufacturerForm } from "./EditManufacturerForm";

function formatDeliveryDays(avgDeliveryDays: number | null): string {
  return avgDeliveryDays === null ? "No arrivals yet" : `${avgDeliveryDays.toFixed(1)} days`;
}

function formatShippingFee(avgShippingFeeCents: number | null): string {
  return avgShippingFeeCents === null ? "No shipments yet" : formatCents(avgShippingFeeCents);
}

export default async function ManufacturerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [manufacturer, stats, reliability, shipments] = await Promise.all([
    prisma.manufacturer.findUnique({ where: { id } }),
    computeManufacturerStats(prisma, id),
    computeReliability(prisma, id),
    prisma.shipment.findMany({
      where: { manufacturerId: id },
      include: { product: { select: { name: true } } },
      orderBy: [{ orderDate: "desc" }, { id: "desc" }],
    }),
  ]);
  if (!manufacturer) notFound();

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <div className="md:w-1/2">
        <h1 className="mb-4 text-2xl font-semibold">{manufacturer.name}</h1>
        <EditManufacturerForm
          manufacturerId={manufacturer.id}
          name={manufacturer.name}
          qualityRating={manufacturer.qualityRating}
          qualityNote={manufacturer.qualityNote}
          easeOfUseRating={manufacturer.easeOfUseRating}
          easeOfUseNote={manufacturer.easeOfUseNote}
        />
      </div>

      <div className="flex flex-col gap-4 md:w-1/2">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Avg Delivery Time
            </p>
            <p className="mt-1 text-sm">{formatDeliveryDays(stats.avgDeliveryDays)}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Avg Shipping Fee
            </p>
            <p className="mt-1 text-sm">{formatShippingFee(stats.avgShippingFeeCents)}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Total Shipments</p>
            <p className="mt-1 text-sm">{stats.totalShipments}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Reliability</p>
            <p className="mt-1 text-sm">
              {reliability.status === "ok"
                ? `${reliability.onTimePct.toFixed(0)}% on time`
                : "Not enough data yet"}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="mb-2 text-sm font-medium">Shipments</h2>
          {shipments.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              No shipments logged yet.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {shipments.map((s) => (
                <li key={s.id} className="py-2 text-sm">
                  <Link href={`/shipments/${s.id}`} className="flex justify-between hover:underline">
                    <span>
                      {s.product.name} · Qty {s.quantityOrdered}
                    </span>
                    <span className="text-neutral-500 dark:text-neutral-400">
                      {s.arrivalDate
                        ? `Arrived ${utcDateToDateString(s.arrivalDate)}`
                        : `Ordered ${utcDateToDateString(s.orderDate)}`}
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
