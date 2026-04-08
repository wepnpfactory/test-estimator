-- Add DEACTIVATED to status enum
ALTER TYPE "DynamicProductStatus" ADD VALUE 'DEACTIVATED';

-- AlterTable: 고객/디자인/파일/주문 동기화 메타 필드 추가
ALTER TABLE "DynamicProduct"
  ADD COLUMN "customerId"       TEXT,
  ADD COLUMN "customerEmail"    TEXT,
  ADD COLUMN "customerName"     TEXT,
  ADD COLUMN "designNo"         TEXT,
  ADD COLUMN "fileUrl"          TEXT,
  ADD COLUMN "fileName"         TEXT,
  ADD COLUMN "cafe24OrderId"    TEXT,
  ADD COLUMN "orderedAt"        TIMESTAMP(3),
  ADD COLUMN "rawOrderSnapshot" JSONB;

CREATE INDEX "DynamicProduct_cafe24OrderId_idx" ON "DynamicProduct"("cafe24OrderId");
CREATE INDEX "DynamicProduct_customerId_idx"   ON "DynamicProduct"("customerId");
