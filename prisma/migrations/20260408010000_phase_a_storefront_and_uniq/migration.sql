-- AlterTable: Cafe24Mall에 storefront/dynamicCategory/defaultShopNo 추가
ALTER TABLE "Cafe24Mall"
  ADD COLUMN "dynamicCategoryNo" INTEGER,
  ADD COLUMN "storefrontOrigin" TEXT,
  ADD COLUMN "defaultShopNo" INTEGER NOT NULL DEFAULT 1;

-- AlterTable: Product에 (mallId, cafe24ProductNo) 복합 유니크 추가
-- 기존 cafe24ProductNo가 NULL이면 PostgreSQL은 NULL을 unique 검사에서 제외하므로 충돌 없음
CREATE UNIQUE INDEX "Product_mallId_cafe24ProductNo_key"
  ON "Product"("mallId", "cafe24ProductNo");
