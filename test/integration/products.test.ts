import { describe, expect, it } from "vitest";
import { testPrisma } from "../db";
import {
  createProduct,
  editProduct,
  InvalidGoalPriceError,
  setProductHidden,
} from "@/lib/products";

describe("createProduct", () => {
  it("creates a product with an existing category and goal price", async () => {
    const category = await testPrisma.category.create({ data: { name: "Toys" } });

    const product = await createProduct(testPrisma, {
      name: "Squishy XL",
      categoryId: category.id,
      goalPrice: "12.50",
    });

    expect(product.name).toBe("Squishy XL");
    expect(product.categoryId).toBe(category.id);
    expect(product.goalPrice?.toString()).toBe("12.5");
    expect(product.hidden).toBe(false);
  });

  it("creates a brand-new category via the inline new-category field", async () => {
    const product = await createProduct(testPrisma, {
      name: "Gadget",
      newCategoryName: "Electronics",
    });

    expect(product.categoryId).not.toBeNull();
    const category = await testPrisma.category.findUnique({
      where: { id: product.categoryId! },
    });
    expect(category?.name).toBe("Electronics");
  });

  it("reuses an existing category case-insensitively instead of duplicating it", async () => {
    const category = await testPrisma.category.create({ data: { name: "Home Goods" } });

    const product = await createProduct(testPrisma, {
      name: "Mug",
      newCategoryName: "home goods",
    });

    expect(product.categoryId).toBe(category.id);
    const categoryCount = await testPrisma.category.count({
      where: { name: { equals: "home goods", mode: "insensitive" } },
    });
    expect(categoryCount).toBe(1);
  });

  it("creates a product with no category and no goal price", async () => {
    const product = await createProduct(testPrisma, { name: "Uncategorized Widget" });
    expect(product.categoryId).toBeNull();
    expect(product.goalPrice).toBeNull();
  });

  it("trims the name", async () => {
    const product = await createProduct(testPrisma, { name: "  Padded Name  " });
    expect(product.name).toBe("Padded Name");
  });

  it("rejects a blank name", async () => {
    await expect(createProduct(testPrisma, { name: "   " })).rejects.toThrow(
      "Product name is required."
    );
  });

  it("rejects a negative goal price", async () => {
    await expect(
      createProduct(testPrisma, { name: "Underwater Price", goalPrice: "-1.00" })
    ).rejects.toThrow(InvalidGoalPriceError);
  });
});

describe("editProduct", () => {
  it("updates name and goal price", async () => {
    const product = await createProduct(testPrisma, { name: "Original", goalPrice: "5.00" });
    const updated = await editProduct(testPrisma, product.id, {
      name: "Renamed",
      goalPrice: "7.25",
    });
    expect(updated.name).toBe("Renamed");
    expect(updated.goalPrice?.toString()).toBe("7.25");
  });

  it("clears the goal price when submitted empty", async () => {
    const product = await createProduct(testPrisma, { name: "Has Price", goalPrice: "5.00" });
    const updated = await editProduct(testPrisma, product.id, { goalPrice: "" });
    expect(updated.goalPrice).toBeNull();
  });

  it("leaves the goal price untouched when not supplied", async () => {
    const product = await createProduct(testPrisma, { name: "Keep Price", goalPrice: "5.00" });
    const updated = await editProduct(testPrisma, product.id, { name: "Keep Price Renamed" });
    expect(updated.goalPrice?.toString()).toBe("5");
  });

  it("reassigns to a different existing category", async () => {
    const catA = await testPrisma.category.create({ data: { name: "Category A" } });
    const catB = await testPrisma.category.create({ data: { name: "Category B" } });
    const product = await createProduct(testPrisma, { name: "Movable", categoryId: catA.id });

    const updated = await editProduct(testPrisma, product.id, { categoryId: catB.id });
    expect(updated.categoryId).toBe(catB.id);
  });

  it("creates and assigns a new category via edit", async () => {
    const product = await createProduct(testPrisma, { name: "Needs Category" });
    const updated = await editProduct(testPrisma, product.id, {
      newCategoryName: "Freshly Added",
    });
    expect(updated.categoryId).not.toBeNull();
    const category = await testPrisma.category.findUnique({
      where: { id: updated.categoryId! },
    });
    expect(category?.name).toBe("Freshly Added");
  });

  it("clears the category when categoryId is explicitly set to null", async () => {
    const cat = await testPrisma.category.create({ data: { name: "Removable" } });
    const product = await createProduct(testPrisma, { name: "Clearable", categoryId: cat.id });

    const updated = await editProduct(testPrisma, product.id, { categoryId: null });
    expect(updated.categoryId).toBeNull();
  });

  it("rejects a negative goal price on edit", async () => {
    const product = await createProduct(testPrisma, { name: "Edit Price Check" });
    await expect(
      editProduct(testPrisma, product.id, { goalPrice: "-0.01" })
    ).rejects.toThrow(InvalidGoalPriceError);
  });
});

describe("setProductHidden", () => {
  it("archives and unarchives a product", async () => {
    const product = await createProduct(testPrisma, { name: "Archivable" });
    expect(product.hidden).toBe(false);

    const archived = await setProductHidden(testPrisma, product.id, true);
    expect(archived.hidden).toBe(true);

    const restored = await setProductHidden(testPrisma, product.id, false);
    expect(restored.hidden).toBe(false);
  });
});
