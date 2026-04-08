import { prisma } from "@/lib/prisma";

// OAuth 설치 직후 진입 시 항상 최신 데이터 노출
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MallsPage() {
  const malls = await prisma.cafe24Mall.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold">Cafe24 몰 연동</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Cafe24 앱스토어에서 본 앱을 설치하면 OAuth 동의 후 자동으로 등록됩니다.
      </p>

      <div className="mt-6 space-y-3">
        {malls.length === 0 && (
          <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700">
            아직 연동된 몰이 없습니다. Cafe24 앱스토어에서 앱을 설치해 주세요.
          </div>
        )}
        {malls.map((m) => {
          const connected = Boolean(m.accessToken);
          const expiresAt = m.tokenExpiresAt
            ? new Date(m.tokenExpiresAt).toLocaleString("ko-KR")
            : null;
          return (
            <div
              key={m.id}
              className="rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between">
                <div className="font-medium">{m.name}</div>
                <span
                  className={
                    "rounded-full px-2 py-0.5 text-xs " +
                    (connected
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300")
                  }
                >
                  {connected ? "연결됨" : "미연결"}
                </span>
              </div>
              <div className="mt-2 space-y-1 text-zinc-500">
                <div>mall_id: {m.mallId}</div>
                {expiresAt && <div>토큰 만료: {expiresAt}</div>}
                {m.scopes.length > 0 && (
                  <div className="text-xs">scope: {m.scopes.join(", ")}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
