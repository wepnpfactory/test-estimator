"use client";

import { useEffect, useState } from "react";

interface Status {
  installed: boolean;
  src?: string;
  count: number;
}

export function ScriptTagControls({ mallDbId }: { mallDbId: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    try {
      const res = await fetch(`/api/admin/cafe24/${mallDbId}/script-tag`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "조회 실패");
      setStatus({
        installed: d.installed,
        src: d.targetSrc,
        count: (d.ours ?? []).length,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "조회 실패");
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mallDbId]);

  async function install() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/cafe24/${mallDbId}/script-tag`, {
        method: "POST",
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "설치 실패");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "설치 실패");
    } finally {
      setBusy(false);
    }
  }

  async function uninstall() {
    if (!confirm("정말 embed.js 스크립트를 제거할까요?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/cafe24/${mallDbId}/script-tag`, {
        method: "DELETE",
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "제거 실패");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "제거 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-zinc-100 bg-zinc-50/60 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium text-zinc-700 dark:text-zinc-300">embed.js 자동 설치</div>
          <div className="mt-0.5 text-[11px] text-zinc-500">
            상품 상세 페이지에 견적 폼이 자동 노출됩니다 (스킨 수정 불필요).
          </div>
          {status && (
            <div className="mt-1 text-[11px]">
              상태:{" "}
              {status.installed ? (
                <span className="font-medium text-emerald-600 dark:text-emerald-400">설치됨</span>
              ) : (
                <span className="text-zinc-500">미설치</span>
              )}{" "}
              {status.count > 0 && `(우리 origin: ${status.count}건)`}
            </div>
          )}
          {error && <div className="mt-1 text-[11px] text-rose-600">{error}</div>}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={install}
            disabled={busy}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300 dark:bg-white dark:text-zinc-900 dark:disabled:bg-zinc-700"
          >
            {busy ? "처리 중…" : "재설치"}
          </button>
          {status?.installed && (
            <button
              type="button"
              onClick={uninstall}
              disabled={busy}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              제거
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
