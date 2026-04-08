import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function ProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: { updatedAt: "desc" },
    include: { mall: true, _count: { select: { optionGroups: true } } },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">상품 연결</h1>
        <Link
          href="/admin/products/new"
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
        >
          + 새 연결
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3 font-medium">이름</th>
              <th className="px-4 py-3 font-medium">몰</th>
              <th className="px-4 py-3 font-medium">Cafe24 상품번호</th>
              <th className="px-4 py-3 font-medium">옵션 그룹</th>
              <th className="px-4 py-3 font-medium">상태</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                  아직 등록된 상품 연결이 없습니다.
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {p.mall.name}
                  </td>
                  <td className="px-4 py-3">{p.cafe24ProductNo ?? "—"}</td>
                  <td className="px-4 py-3">{p._count.optionGroups}</td>
                  <td className="px-4 py-3">{p.status}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/products/${p.id}`}
                      className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                    >
                      편집
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
