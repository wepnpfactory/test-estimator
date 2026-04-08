-- Add perSheet/perQuantity to OptionGroup
ALTER TABLE "OptionGroup"
  ADD COLUMN "perSheet"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "perQuantity" BOOLEAN NOT NULL DEFAULT false;

-- Backfill from any existing item flags (가장 흔한 케이스: 그룹 안 아이템들이 모두 동일 플래그)
UPDATE "OptionGroup" g SET "perSheet" = true
  WHERE EXISTS (SELECT 1 FROM "OptionItem" i WHERE i."groupId" = g.id AND i."perSheet" = true);
UPDATE "OptionGroup" g SET "perQuantity" = true
  WHERE EXISTS (SELECT 1 FROM "OptionItem" i WHERE i."groupId" = g.id AND i."perQuantity" = true);

-- Drop columns from OptionItem
ALTER TABLE "OptionItem"
  DROP COLUMN "perSheet",
  DROP COLUMN "perQuantity";
