-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OptionDisplayType" AS ENUM ('SELECT', 'RADIO', 'SWATCH', 'NUMBER');

-- CreateEnum
CREATE TYPE "PriceRuleAction" AS ENUM ('ADD_FIXED', 'SUBTRACT_FIXED', 'ADD_PERCENT', 'SUBTRACT_PERCENT', 'OVERRIDE');

-- CreateEnum
CREATE TYPE "DynamicProductStatus" AS ENUM ('CREATED', 'IN_CART', 'ORDERED', 'EXPIRED', 'FAILED');

-- CreateTable
CREATE TABLE "Cafe24Mall" (
    "id" TEXT NOT NULL,
    "mallId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaultCategoryNo" INTEGER,
    "hideDynamicProducts" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cafe24Mall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "mallId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "basePrice" INTEGER NOT NULL DEFAULT 0,
    "cafe24ProductNo" INTEGER,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptionGroup" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayType" "OptionDisplayType" NOT NULL DEFAULT 'SELECT',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OptionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptionItem" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "addPrice" INTEGER NOT NULL DEFAULT 0,
    "stock" INTEGER,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "OptionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceRule" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "action" "PriceRuleAction" NOT NULL,
    "amount" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PriceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DynamicProduct" (
    "id" TEXT NOT NULL,
    "mallId" TEXT NOT NULL,
    "sourceProductId" TEXT NOT NULL,
    "cafe24ProductNo" INTEGER,
    "cafe24ProductCode" TEXT,
    "selectedOptions" JSONB NOT NULL,
    "finalPrice" INTEGER NOT NULL,
    "status" "DynamicProductStatus" NOT NULL DEFAULT 'CREATED',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DynamicProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cafe24Mall_mallId_key" ON "Cafe24Mall"("mallId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_mallId_status_idx" ON "Product"("mallId", "status");

-- CreateIndex
CREATE INDEX "OptionGroup_productId_sortOrder_idx" ON "OptionGroup"("productId", "sortOrder");

-- CreateIndex
CREATE INDEX "OptionItem_groupId_sortOrder_idx" ON "OptionItem"("groupId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "OptionItem_groupId_value_key" ON "OptionItem"("groupId", "value");

-- CreateIndex
CREATE INDEX "PriceRule_productId_sortOrder_idx" ON "PriceRule"("productId", "sortOrder");

-- CreateIndex
CREATE INDEX "DynamicProduct_mallId_status_idx" ON "DynamicProduct"("mallId", "status");

-- CreateIndex
CREATE INDEX "DynamicProduct_expiresAt_idx" ON "DynamicProduct"("expiresAt");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_mallId_fkey" FOREIGN KEY ("mallId") REFERENCES "Cafe24Mall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionGroup" ADD CONSTRAINT "OptionGroup_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionItem" ADD CONSTRAINT "OptionItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "OptionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceRule" ADD CONSTRAINT "PriceRule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DynamicProduct" ADD CONSTRAINT "DynamicProduct_mallId_fkey" FOREIGN KEY ("mallId") REFERENCES "Cafe24Mall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DynamicProduct" ADD CONSTRAINT "DynamicProduct_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
