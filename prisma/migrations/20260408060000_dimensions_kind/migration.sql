-- Add DIMENSIONS to OptionGroupKind enum
ALTER TYPE "OptionGroupKind" ADD VALUE 'DIMENSIONS';

-- Add widthMm/heightMm to OptionItem
ALTER TABLE "OptionItem"
  ADD COLUMN "widthMm"  INTEGER,
  ADD COLUMN "heightMm" INTEGER;
