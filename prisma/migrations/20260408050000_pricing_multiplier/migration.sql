-- OptionGroupKind enum
CREATE TYPE "OptionGroupKind" AS ENUM ('NORMAL', 'SHEET_COUNT', 'QUANTITY');

-- OptionGroup: kind, showWhen
ALTER TABLE "OptionGroup"
  ADD COLUMN "kind"     "OptionGroupKind" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "showWhen" JSONB;

-- OptionItem: multiplier, perSheet, perQuantity
ALTER TABLE "OptionItem"
  ADD COLUMN "multiplier"  INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "perSheet"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "perQuantity" BOOLEAN NOT NULL DEFAULT false;
