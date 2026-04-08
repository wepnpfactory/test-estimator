import { prisma } from "@/lib/prisma";
import { ScriptTagControls } from "./_components/script-tag-controls";

// OAuth 설치 직후 진입 시 항상 최신 데이터 노출
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MallsPage() {
  const malls = await prisma.cafe24Mall.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Cafe24 몰 연동</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Cafe24 앱스토어에서 본 앱을 설치하면 OAuth 동의 후 자동으로 등록됩니다.
        </p>
      </header>

      <div className="space-y-3">
        {malls.length === 0 && (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-zinc-300 bg-white/50 px-6 py-12 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 9l9-6 9 6v11a1 1 0 01-1 1h-5v-7H10v7H5a1 1 0 01-1-1V9z" />
              </svg>
            </div>
            <div className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-200">아직 연동된 몰이 없습니다</div>
            <div className="mt-1 text-xs text-zinc-500">Cafe24 앱스토어에서 앱을 설치해 주세요.</div>
          </div>
        )}

        {malls.map((m) => {
          const connected = Boolean(m.accessToken);
          const expiresAt = m.tokenExpiresAt ? new Date(m.tokenExpiresAt).toLocaleString("ko-KR") : null;
          return (
            <div
              key={m.id}
              className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-sm font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {m.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">{m.name}</div>
                    <div className="text-xs text-zinc-500">
                      mall_id · <span className="font-mono">{m.mallId}</span>
                    </div>
                  </div>
                </div>
                <span
                  className={
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset " +
                    (connected
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30"
                      : "bg-zinc-100 text-zinc-600 ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-500/30")
                  }
                >
                  <span className={"h-1.5 w-1.5 rounded-full " + (connected ? "bg-emerald-500" : "bg-zinc-400")} />
                  {connected ? "연결됨" : "미연결"}
                </span>
              </div>
              {(expiresAt || m.scopes.length > 0) && (
                <dl className="mt-4 grid grid-cols-1 gap-y-1.5 border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-800">
                  {expiresAt && (
                    <div className="flex gap-2">
                      <dt className="w-20 text-zinc-400">토큰 만료</dt>
                      <dd className="tabular-nums">{expiresAt}</dd>
                    </div>
                  )}
                  {m.scopes.length > 0 && (
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0 text-zinc-400">scope</dt>
                      <dd className="font-mono">{m.scopes.join(", ")}</dd>
                    </div>
                  )}
                </dl>
              )}
              {connected && <ScriptTagControls mallDbId={m.id} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
