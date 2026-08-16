import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { decimalToCents, formatCents } from "@/lib/money";
import { utcDateToDateString } from "@/lib/dates";
import { saleProfitCents } from "@/lib/sales";
import { EditSaleForm } from "./EditSaleForm";
import { DeleteSaleButton } from "./DeleteSaleButton";

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [sale, routes] = await Promise.all([
    prisma.sale.findUnique({
      where: { id },
      include: {
        product: { select: { name: true } },
        saleRoute: { select: { name: true } },
        allocations: {
          include: { shipment: { select: { arrivalDate: true } } },
          orderBy: { sequence: "asc" },
        },
      },
    }),
    prisma.saleRoute.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!sale) notFound();

  const profitCents = saleProfitCents(sale);

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <div className="flex w-full flex-col gap-4 md:w-1/2">
        <div>
          <h1 className="text-2xl font-semibold">{sale.product.name}</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Sold {utcDateToDateString(sale.saleDate)}
          </p>
        </div>
        <EditSaleForm
          saleId={sale.id}
          routes={routes}
          quantity={sale.quantity}
          pricePerUnit={sale.pricePerUnit.toFixed(2)}
          saleRouteId={sale.saleRouteId}
        />
        <DeleteSaleButton saleId={sale.id} />
      </div>

      <div className="flex w-full flex-col gap-4 md:w-1/2">
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="mb-2 text-sm font-medium">Summary</h2>
          <div className="flex flex-col gap-1 text-sm">
            <p>
              Revenue:{" "}
              <span className="font-medium">
                {formatCents(decimalToCents(sale.pricePerUnit) * sale.quantity)}
              </span>
            </p>
            <p>
              Cost basis:{" "}
              <span className="font-medium">
                {formatCents(sale.allocations.reduce((sum, a) => sum + a.costBasisCents, 0))}
              </span>
            </p>
            <p>
              Profit:{" "}
              <span className={profitCents < 0 ? "text-red-600 dark:text-red-400" : "font-medium"}>
                {formatCents(profitCents)}
              </span>
            </p>
            <p>Route: {sale.saleRoute.name}</p>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="mb-2 text-sm font-medium">Batch Allocations</h2>
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {sale.allocations.map((a) => (
              <li key={a.id} className="flex justify-between py-2 text-sm">
                <span>
                  {a.quantity} unit{a.quantity === 1 ? "" : "s"} · arrived{" "}
                  {a.shipment.arrivalDate ? utcDateToDateString(a.shipment.arrivalDate) : "—"}
                </span>
                <span className="text-neutral-500 dark:text-neutral-400">
                  {formatCents(a.costBasisCents)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
