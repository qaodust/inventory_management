import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EditManufacturerForm } from "./EditManufacturerForm";

export default async function ManufacturerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const manufacturer = await prisma.manufacturer.findUnique({ where: { id } });
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
            <p className="mt-1 text-sm">No shipments yet</p>
          </div>
          <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Avg Shipping Fee
            </p>
            <p className="mt-1 text-sm">No shipments yet</p>
          </div>
          <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Total Shipments</p>
            <p className="mt-1 text-sm">0</p>
          </div>
          <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Reliability</p>
            <p className="mt-1 text-sm">Not enough data yet</p>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="mb-2 text-sm font-medium">Shipments</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            No shipments logged yet — this section populates once Shipments
            (Phase 4) is built.
          </p>
        </div>
      </div>
    </div>
  );
}
