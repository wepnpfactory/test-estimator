import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { syncOrders } from "@/lib/cafe24/orders";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function syncAction(formData: FormData) {
  "use server";
  const mallDbId = String(formData.get("mallId") || "");
  const days = Math.max(1, Math.min(30, Number(formData.get("days") || 7)));
  if (!mallDbId) return;

  const mall = await prisma.cafe24Mall.findUnique({ where: { id: mallDbId } });
  if (!mall || !mall.accessToken) return;

  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - days);

  await syncOrders({ mall, startDate: start, endDate: end });
  revalidatePath("/admin/orders");
}

export default async function OrdersPage() {
  const [malls, dynamics] = await Promise.all([
    prisma.cafe24Mall.findMany({
      where: { accessToken: { not: null } },
      orderBy: { name: "asc" },
    }),
    prisma.dynamicProduct.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: { mall: true, sourceProduct: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">주문 동기화</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Cafe24에서 최근 주문을 가져와 동적 상품과 매칭합니다. 매칭된 주문은 자동으로 비활성화됩니다.
        </p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {malls.length === 0 ? (
          <p className="text-sm text-zinc-500">연결된 몰이 없습니다.</p>
        ) : (
          <form action={syncAction} className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-500">몰</span>
              <select name="mallId" className={inputCls} defaultValue={malls[0].id}>
                {malls.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.mallId})
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-500">최근 N일</span>
              <input
                type="number"
                name="days"
                defaultValue={7}
                min={1}
                max={30}
                className={inputCls + " w-24"}
              />
            </label>
            <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900">
              지금 동기화
            </button>
          </form>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50/60 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">상품</th>
              <th className="px-4 py-3">최종가</th>
              <th className="px-4 py-3">고객</th>
              <th className="px-4 py-3">디자인 / 파일</th>
              <th className="px-4 py-3">주문번호</th>
              <th className="px-4 py-3">생성</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {dynamics.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-zinc-500">
                  아직 동적 상품이 없습니다.
                </td>
              </tr>
            ) : (
              dynamics.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {d.sourceProduct.name}
                    <div className="text-[11px] text-zinc-400">
                      #{d.cafe24ProductNo ?? "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                    {d.finalPrice.toLocaleString()}원
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {d.customerName || d.customerEmail || d.customerId || "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {d.designNo && (
                      <div className="font-mono text-[11px]">{d.designNo}</div>
                    )}
                    {d.fileUrl && (
                      <a
                        href={d.fileUrl}
                        target="_blank"
                        rel="noopener"
                        className="text-[11px] text-blue-600 underline"
                      >
                        {d.fileName || "파일"}
                      </a>
                    )}
                    {!d.designNo && !d.fileUrl && "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                    {d.cafe24OrderId || "—"}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-zinc-500">
                    {new Date(d.createdAt).toLocaleString("ko-KR")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

const inputCls =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    CREATED: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    IN_CART: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
    ORDERED:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
    DEACTIVATED:
      "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
    EXPIRED: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
    FAILED: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
  };
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
        (map[status] || map.CREATED)
      }
    >
      {status}
    </span>
  );
}
