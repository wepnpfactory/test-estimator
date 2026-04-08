-- Product: baseAreaMm2
ALTER TABLE "Product"
  ADD COLUMN "baseAreaMm2" INTEGER NOT NULL DEFAULT 62370;

-- OptionGroup: perArea, allowDirectInput, min/max
ALTER TABLE "OptionGroup"
  ADD COLUMN "perArea"          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "allowDirectInput" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "minDirectInput"   INTEGER,
  ADD COLUMN "maxDirectInput"   INTEGER;

-- OptionItem: showWhen
ALTER TABLE "OptionItem"
  ADD COLUMN "showWhen" JSONB;
