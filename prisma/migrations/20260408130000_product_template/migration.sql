CREATE TYPE "ProductTemplate" AS ENUM ('NONE', 'BOOKLET', 'FLAT_PRINT');

ALTER TABLE "Product"
  ADD COLUMN "template" "ProductTemplate" NOT NULL DEFAULT 'NONE';
