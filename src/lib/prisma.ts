import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

// Vercel Postgres(Neon)용 어댑터 기반 싱글톤
// 로컬에서 vercel env pull로 받은 DATABASE_URL 사용
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // Vercel Neon 통합이 주입하는 변수 사용 (POSTGRES_PRISMA_URL 우선 = pooled)
  const connectionString = process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("POSTGRES_URL is not set. Run `vercel env pull .env.local`.");
  }
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
