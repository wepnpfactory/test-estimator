import Link from "next/link";
import { prisma } from "@/lib/prisma";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE:
      "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30",
    DRAFT:
      "bg-zinc-100 text-zinc-600 ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-500/30",
    ARCHIVED:
      "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/30",
  };
  const cls = map[status] ?? map.DRAFT;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}
    >
      {status}
    </span>
  );
}

export default async function ProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: { updatedAt: "desc" },
    include: { mall: true, _count: { select: { optionGroups: true } } },
  });

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">상품 연결</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Cafe24 상품을 견적 엔진에 연결하고 옵션 그룹을 관리합니다.
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors duration-150 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 active:scale-[0.98] dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 dark:focus-visible:ring-zinc-100"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          새 연결
        </Link>
      </header>

      {products.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-zinc-300 bg-white/50 px-6 py-16 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 7L12 3 4 7v10l8 4 8-4V7zM4 7l8 4 8-4M12 11v10" />
            </svg>
          </div>
          <div className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-200">
            아직 등록된 상품 연결이 없습니다
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            첫 상품을 연결해 견적 엔진을 활성화하세요.
          </div>
          <Link
            href="/admin/products/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors duration-150 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 dark:focus-visible:ring-zinc-100"
          >
            새 연결 만들기
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none dark:ring-1 dark:ring-white/5">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50/60 text-left text-[12px] font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3">이름</th>
                <th className="px-4 py-3">몰</th>
                <th className="px-4 py-3">Cafe24 상품번호</th>
                <th className="px-4 py-3">옵션 그룹</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3"><span className="sr-only">액션</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800">
              {products.map((p) => (
                <tr
                  key={p.id}
                  className="transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40"
                >
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                    {p.name}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {p.mall.name}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-400">
                    {p.cafe24ProductNo ?? "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-400">
                    {p._count.optionGroups}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/products/${p.id}`}
                      className="rounded text-sm font-medium text-zinc-600 transition-colors duration-150 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:text-zinc-400 dark:hover:text-zinc-100 dark:focus-visible:ring-zinc-100"
                    >
                      편집 →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
