import { prisma } from "@/lib/prisma";

export default async function AdminDashboard() {
  const [productCount, mallCount, dynamicCount] = await Promise.all([
    prisma.product.count(),
    prisma.cafe24Mall.count(),
    prisma.dynamicProduct.count(),
  ]);

  const stats = [
    {
      label: "연결된 상품",
      value: productCount,
      hint: "관리자에 등록된 견적 상품",
      accent: "from-indigo-500/10 to-indigo-500/0 text-indigo-600 dark:text-indigo-400",
    },
    {
      label: "연동된 몰",
      value: mallCount,
      hint: "OAuth로 연결된 Cafe24 몰",
      accent: "from-emerald-500/10 to-emerald-500/0 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "생성된 동적 상품",
      value: dynamicCount,
      hint: "견적으로 자동 등록된 상품",
      accent: "from-amber-500/10 to-amber-500/0 text-amber-600 dark:text-amber-400",
    },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">대시보드</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">현재 연결 상태와 핵심 지표를 확인하세요.</p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow duration-150 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none dark:ring-1 dark:ring-white/5"
          >
            <div
              className={`pointer-events-none absolute inset-0 bg-linear-to-br ${s.accent} opacity-60`}
              aria-hidden
            />
            <div className="relative">
              <div className="text-[12px] font-medium text-zinc-500 dark:text-zinc-400">{s.label}</div>
              <div className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">{s.value.toLocaleString()}</div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">{s.hint}</div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
