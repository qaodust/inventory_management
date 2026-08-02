-- CreateEnum
CREATE TYPE "AdjustmentReason" AS ENUM ('DAMAGE', 'LOSS', 'SAMPLE', 'RETURN', 'COUNT_CORRECTION', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manufacturer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qualityRating" INTEGER,
    "qualityNote" TEXT,
    "easeOfUseRating" INTEGER,
    "easeOfUseNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Manufacturer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT,
    "goalPrice" DECIMAL(12,2),
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityOrdered" INTEGER NOT NULL,
    "productCost" DECIMAL(12,2) NOT NULL,
    "shippingFee" DECIMAL(12,2) NOT NULL,
    "orderDate" DATE NOT NULL,
    "expectedArrivalDate" DATE,
    "arrivalDate" DATE,
    "loggedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryAdjustment" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "reason" "AdjustmentReason" NOT NULL,
    "note" TEXT,
    "effectiveDate" DATE NOT NULL,
    "actingUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleRoute" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "pricePerUnit" DECIMAL(12,2) NOT NULL,
    "saleRouteId" TEXT NOT NULL,
    "saleDate" DATE NOT NULL,
    "loggedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleAllocation" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitStartIndex" INTEGER NOT NULL,
    "costBasisCents" INTEGER NOT NULL,
    "sequence" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Manufacturer_name_key" ON "Manufacturer"("name");

-- CreateIndex
CREATE INDEX "Manufacturer_name_idx" ON "Manufacturer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_hidden_idx" ON "Product"("hidden");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "Shipment_productId_arrivalDate_id_idx" ON "Shipment"("productId", "arrivalDate", "id");

-- CreateIndex
CREATE INDEX "Shipment_manufacturerId_arrivalDate_idx" ON "Shipment"("manufacturerId", "arrivalDate");

-- CreateIndex
CREATE INDEX "Shipment_arrivalDate_idx" ON "Shipment"("arrivalDate");

-- CreateIndex
CREATE INDEX "InventoryAdjustment_shipmentId_idx" ON "InventoryAdjustment"("shipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleRoute_name_key" ON "SaleRoute"("name");

-- CreateIndex
CREATE INDEX "Sale_productId_saleDate_idx" ON "Sale"("productId", "saleDate");

-- CreateIndex
CREATE INDEX "Sale_saleRouteId_saleDate_idx" ON "Sale"("saleRouteId", "saleDate");

-- CreateIndex
CREATE UNIQUE INDEX "SaleAllocation_sequence_key" ON "SaleAllocation"("sequence");

-- CreateIndex
CREATE INDEX "SaleAllocation_shipmentId_sequence_idx" ON "SaleAllocation"("shipmentId", "sequence");

-- CreateIndex
CREATE INDEX "SaleAllocation_saleId_idx" ON "SaleAllocation"("saleId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_loggedByUserId_fkey" FOREIGN KEY ("loggedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_actingUserId_fkey" FOREIGN KEY ("actingUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_saleRouteId_fkey" FOREIGN KEY ("saleRouteId") REFERENCES "SaleRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_loggedByUserId_fkey" FOREIGN KEY ("loggedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleAllocation" ADD CONSTRAINT "SaleAllocation_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleAllocation" ADD CONSTRAINT "SaleAllocation_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraint (hand-added: Prisma schema syntax has no @@check attribute)
ALTER TABLE "Manufacturer" ADD CONSTRAINT "Manufacturer_qualityRating_range" CHECK ("qualityRating" IS NULL OR "qualityRating" BETWEEN 1 AND 5);
ALTER TABLE "Manufacturer" ADD CONSTRAINT "Manufacturer_easeOfUseRating_range" CHECK ("easeOfUseRating" IS NULL OR "easeOfUseRating" BETWEEN 1 AND 5);

ALTER TABLE "Product" ADD CONSTRAINT "Product_goalPrice_nonnegative" CHECK ("goalPrice" IS NULL OR "goalPrice" >= 0);

ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_quantityOrdered_positive" CHECK ("quantityOrdered" > 0);
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_productCost_nonnegative" CHECK ("productCost" >= 0);
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_shippingFee_nonnegative" CHECK ("shippingFee" >= 0);

ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_quantityDelta_nonzero" CHECK ("quantityDelta" <> 0);
ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_note_required_when_other" CHECK ("reason" <> 'OTHER' OR "note" IS NOT NULL);

ALTER TABLE "Sale" ADD CONSTRAINT "Sale_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_pricePerUnit_nonnegative" CHECK ("pricePerUnit" >= 0);

ALTER TABLE "SaleAllocation" ADD CONSTRAINT "SaleAllocation_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "SaleAllocation" ADD CONSTRAINT "SaleAllocation_unitStartIndex_nonnegative" CHECK ("unitStartIndex" >= 0);
ALTER TABLE "SaleAllocation" ADD CONSTRAINT "SaleAllocation_costBasisCents_nonnegative" CHECK ("costBasisCents" >= 0);
