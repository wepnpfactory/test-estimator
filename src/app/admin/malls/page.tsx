import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

async function createMall(formData: FormData) {
  "use server";
  const mallId = String(formData.get("mallId") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const clientId = String(formData.get("clientId") || "").trim();
  const clientSecret = String(formData.get("clientSecret") || "").trim();
  if (!mallId || !name || !clientId || !clientSecret) return;
  await prisma.cafe24Mall.create({
    data: { mallId, name, clientId, clientSecret },
  });
  revalidatePath("/admin/malls");
}

export default async function MallsPage() {
  const malls = await prisma.cafe24Mall.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold">Cafe24 몰 연동</h1>

      <div className="mt-6 space-y-3">
        {malls.length === 0 && (
          <p className="text-sm text-zinc-500">연동된 몰이 없습니다.</p>
        )}
        {malls.map((m) => (
          <div
            key={m.id}
            className="rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="font-medium">{m.name}</div>
            <div className="mt-1 text-zinc-500">
              mall_id: {m.mallId} · 토큰:{" "}
              {m.accessToken ? "연결됨" : "미연결 (OAuth 필요)"}
            </div>
          </div>
        ))}
      </div>

      <form action={createMall} className="mt-8 space-y-3">
        <h2 className="text-base font-semibold">새 몰 등록</h2>
        <input name="mallId" placeholder="mall_id (예: myshop)" className={inputCls} />
        <input name="name" placeholder="표시 이름" className={inputCls} />
        <input name="clientId" placeholder="Cafe24 Client ID" className={inputCls} />
        <input
          name="clientSecret"
          placeholder="Cafe24 Client Secret"
          className={inputCls}
        />
        <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900">
          등록
        </button>
      </form>
    </div>
  );
}

const inputCls =
  "block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";
