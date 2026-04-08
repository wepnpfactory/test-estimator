import { prisma } from "@/lib/prisma";

export default async function AdminDashboard() {
  const [productCount, mallCount, dynamicCount] = await Promise.all([
    prisma.product.count(),
    prisma.cafe24Mall.count(),
    prisma.dynamicProduct.count(),
  ]);

  const stats = [
    { label: "연결된 상품", value: productCount },
    { label: "연동된 몰", value: mallCount },
    { label: "생성된 동적 상품", value: dynamicCount },
  ];

  return (
    <div>
      <h1 className="text-xl font-semibold">대시보드</h1>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="text-sm text-zinc-500">{s.label}</div>
            <div className="mt-2 text-2xl font-semibold">{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
