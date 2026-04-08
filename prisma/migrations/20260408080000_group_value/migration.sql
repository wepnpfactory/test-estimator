ALTER TABLE "OptionGroup" ADD COLUMN "value" TEXT;

CREATE UNIQUE INDEX "OptionGroup_productId_value_key"
  ON "OptionGroup"("productId", "value");
