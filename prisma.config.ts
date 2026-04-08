import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Vercel에서 pull한 .env.local 우선 로드 (없으면 .env)
loadEnv({ path: ".env.local" });
loadEnv();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // 마이그레이션은 non-pooling 연결을 써야 안정적
    url:
      process.env["POSTGRES_URL_NON_POOLING"] ??
      process.env["POSTGRES_URL"] ??
      process.env["DATABASE_URL"],
  },
});
