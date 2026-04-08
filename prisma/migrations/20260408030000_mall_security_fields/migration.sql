ALTER TABLE "Cafe24Mall"
  ADD COLUMN "allowedOrigins" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "embedSecret"    TEXT;
