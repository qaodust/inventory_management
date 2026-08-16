import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getProductBatches } from "@/lib/metrics";
import { utcDateToDateString } from "@/lib/dates";
import { LogSaleForm, type SellableProduct } from "./LogSaleForm";

export default async function SalesPage() {
  const [products, routes] = await Promise.all([
    prisma.product.findMany({
      where: { hidden: false },
      orderBy: { name: "asc" },
    }),
    prisma.saleRoute.findMany({ orderBy: { name: "asc" } }),
  ]);

  const batchesByProduct = await Promise.all(
    products.map((p) => getProductBatches(prisma, p.id))
  );

  const sellableProducts: SellableProduct[] = products.map((p, i) => ({
    id: p.id,
    name: p.name,
    goalPrice: p.goalPrice ? p.goalPrice.toFixed(2) : null,
    batches: batchesByProduct[i]
      .filter((b) => b.remainingQty > 0)
      .map((b) => ({
        remainingQty: b.remainingQty,
        costPerUnitCents: b.costPerUnitCents,
        arrivalDate: utcDateToDateString(b.arrivalDate),
      })),
  }));

  return (
    <div className="flex flex-col gap-4 pb-16 md:pb-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Log Sale</h1>
        <Link
          href="/sales/history"
          className="text-sm font-medium text-neutral-600 hover:underline dark:text-neutral-400"
        >
          History
        </Link>
      </div>

      <LogSaleForm products={sellableProducts} routes={routes} />
    </div>
  );
}
