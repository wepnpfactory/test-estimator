-- CHECKBOX display type
ALTER TYPE "OptionDisplayType" ADD VALUE IF NOT EXISTS 'CHECKBOX';

-- ShipmentMethod enum
DO $$ BEGIN
  CREATE TYPE "ShipmentMethod" AS ENUM ('PARCEL', 'PICKUP', 'QUICK', 'DIRECT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Product.leadTimeDays
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "leadTimeDays" INTEGER NOT NULL DEFAULT 1;

-- OptionGroup.multiSelect
ALTER TABLE "OptionGroup" ADD COLUMN IF NOT EXISTS "multiSelect" BOOLEAN NOT NULL DEFAULT false;

-- OptionItem.leadTimeDays
ALTER TABLE "OptionItem" ADD COLUMN IF NOT EXISTS "leadTimeDays" INTEGER NOT NULL DEFAULT 0;

-- DynamicProduct.leadTimeDays + estimatedShipAt
ALTER TABLE "DynamicProduct" ADD COLUMN IF NOT EXISTS "leadTimeDays" INTEGER;
ALTER TABLE "DynamicProduct" ADD COLUMN IF NOT EXISTS "estimatedShipAt" TIMESTAMP(3);

-- DynamicProductShipment
CREATE TABLE IF NOT EXISTS "DynamicProductShipment" (
  "id" TEXT NOT NULL,
  "dynamicProductId" TEXT NOT NULL,
  "recipientName" TEXT,
  "recipientPhone" TEXT,
  "postalCode" TEXT,
  "address1" TEXT NOT NULL,
  "address2" TEXT,
  "quantity" INTEGER NOT NULL,
  "method" "ShipmentMethod" NOT NULL DEFAULT 'PARCEL',
  "memo" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "DynamicProductShipment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DynamicProductShipment_dynamicProductId_sortOrder_idx"
  ON "DynamicProductShipment" ("dynamicProductId", "sortOrder");

ALTER TABLE "DynamicProductShipment"
  DROP CONSTRAINT IF EXISTS "DynamicProductShipment_dynamicProductId_fkey";
ALTER TABLE "DynamicProductShipment"
  ADD CONSTRAINT "DynamicProductShipment_dynamicProductId_fkey"
  FOREIGN KEY ("dynamicProductId") REFERENCES "DynamicProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
