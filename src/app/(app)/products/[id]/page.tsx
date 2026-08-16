import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/money";
import { getProductBatches } from "@/lib/metrics";
import { utcDateToDateString } from "@/lib/dates";
import { EditProductForm } from "./EditProductForm";
import { setProductArchivedAction } from "./actions";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, categories, batches] = await Promise.all([
    prisma.product.findUnique({ where: { id }, include: { category: true } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    getProductBatches(prisma, id),
  ]);
  if (!product) notFound();

  const toggleHidden = setProductArchivedAction.bind(null, product.id, !product.hidden);

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <div className="md:w-1/2">
        <div className="mb-4 flex items-center gap-2">
          <h1 className="text-2xl font-semibold">{product.name}</h1>
          {product.hidden && (
            <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
              Archived
            </span>
          )}
        </div>
        <EditProductForm
          productId={product.id}
          name={product.name}
          goalPrice={product.goalPrice ? product.goalPrice.toFixed(2) : ""}
          categoryId={product.categoryId}
          categories={categories}
        />

        <form action={toggleHidden} className="mt-4">
          <button
            type="submit"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            {product.hidden ? "Unarchive" : "Archive"}
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-4 md:w-1/2">
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium">Batches</h2>
            <Link
              href="/shipments/new"
              className="text-sm font-medium text-neutral-600 hover:underline dark:text-neutral-400"
            >
              Log Shipment
            </Link>
          </div>
          {batches.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              No batches arrived yet — this section populates once shipments for
              this product are marked arrived.
            </p>
          ) : (
            <>
              {/* PC: table */}
              <div className="hidden overflow-hidden rounded-md border border-neutral-200 md:block dark:border-neutral-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-neutral-50 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
                    <tr>
                      <th className="px-3 py-2 font-medium">Arrival Date</th>
                      <th className="px-3 py-2 font-medium">Manufacturer</th>
                      <th className="px-3 py-2 font-medium">Qty Remaining</th>
                      <th className="px-3 py-2 font-medium">Cost/Unit</th>
                      <th className="px-3 py-2 font-medium">Sell-Through</th>
                      <th className="px-3 py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {batches.map((b) => (
                      <tr key={b.id}>
                        <td className="px-3 py-2">
                          <Link href={`/shipments/${b.id}`} className="hover:underline">
                            {utcDateToDateString(b.arrivalDate)}
                          </Link>
                        </td>
                        <td className="px-3 py-2">{b.manufacturerName}</td>
                        <td className="px-3 py-2">
                          {b.remainingQty} / {b.quantityOrdered}
                        </td>
                        <td className="px-3 py-2">{formatCents(b.costPerUnitCents)}</td>
                        <td className="px-3 py-2">
                          {b.sellThroughDate ? utcDateToDateString(b.sellThroughDate) : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <Link
                            href={`/products/${product.id}/batches/${b.id}/adjust`}
                            className="text-neutral-600 hover:underline dark:text-neutral-400"
                          >
                            Adjust
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: cards */}
              <div className="flex flex-col gap-2 md:hidden">
                {batches.map((b) => (
                  <div
                    key={b.id}
                    className="flex flex-col gap-1 rounded-md border border-neutral-200 p-3 dark:border-neutral-800"
                  >
                    <div className="flex items-center justify-between">
                      <Link href={`/shipments/${b.id}`} className="font-medium hover:underline">
                        {utcDateToDateString(b.arrivalDate)}
                      </Link>
                      <Link
                        href={`/products/${product.id}/batches/${b.id}/adjust`}
                        className="text-sm text-neutral-600 hover:underline dark:text-neutral-400"
                      >
                        Adjust
                      </Link>
                    </div>
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">
                      {b.manufacturerName} · {b.remainingQty} / {b.quantityOrdered} remaining
                    </span>
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">
                      {formatCents(b.costPerUnitCents)}/unit
                      {b.sellThroughDate
                        ? ` · Sold through ${utcDateToDateString(b.sellThroughDate)}`
                        : ""}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
