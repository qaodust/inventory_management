import { prisma } from "@/lib/prisma";
import { NewProductForm } from "./NewProductForm";

export default async function NewProductPage() {
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Add Product</h1>
      <NewProductForm categories={categories} />
    </div>
  );
}
