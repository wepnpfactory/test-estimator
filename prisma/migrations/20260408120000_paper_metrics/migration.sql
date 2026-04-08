-- Product: bleedMm
ALTER TABLE "Product"
  ADD COLUMN "bleedMm" INTEGER NOT NULL DEFAULT 3;

-- OptionGroup: isInnerPaper, isCoverPaper
ALTER TABLE "OptionGroup"
  ADD COLUMN "isInnerPaper" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isCoverPaper" BOOLEAN NOT NULL DEFAULT false;

-- OptionItem: thicknessMm
ALTER TABLE "OptionItem"
  ADD COLUMN "thicknessMm" DOUBLE PRECISION;
