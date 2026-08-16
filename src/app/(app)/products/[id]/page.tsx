import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EditProductForm } from "./EditProductForm";
import { setProductArchivedAction } from "./actions";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    prisma.product.findUnique({ where: { id }, include: { category: true } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
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
          <h2 className="mb-2 text-sm font-medium">Batches</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            No batches logged yet — this section populates once Batches
            (Phase 4) is built.
          </p>
        </div>
      </div>
    </div>
  );
}
