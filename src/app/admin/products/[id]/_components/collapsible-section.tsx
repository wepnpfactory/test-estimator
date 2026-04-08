"use client";

import { ChevronDown } from "lucide-react";
import { useCallback, useSyncExternalStore, type ReactNode } from "react";

interface CollapsibleSectionProps {
  storageKey: string;
  defaultOpen?: boolean;
  summary: ReactNode;
  children: ReactNode;
}

/**
 * localStorage 변경을 구독하는 헬퍼 — 같은 탭의 다른 인스턴스가 값을 바꿔도
 * 동기화되도록 'storage' 이벤트와 커스텀 이벤트를 모두 listen.
 */
function subscribeLocalStorage(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener("te:localstorage", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("te:localstorage", callback);
  };
}

/**
 * 서버 렌더링된 콘텐츠를 감싸는 접기/펼치기 래퍼.
 * open 상태는 storageKey 별로 localStorage에 유지된다.
 *
 * useSyncExternalStore 로 localStorage 와 동기화 — effect/cascade 없음.
 * SSR 시에는 defaultOpen, 클라이언트 mount 후 자동으로 저장값으로 전환된다.
 */
export function CollapsibleSection({
  storageKey,
  defaultOpen = true,
  summary,
  children,
}: CollapsibleSectionProps) {
  const getSnapshot = useCallback((): boolean => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved !== null) return saved === "1";
    } catch {}
    return defaultOpen;
  }, [storageKey, defaultOpen]);

  // SSR snapshot — 서버에선 기본값만 안다
  const getServerSnapshot = useCallback(
    (): boolean => defaultOpen,
    [defaultOpen],
  );

  const open = useSyncExternalStore(
    subscribeLocalStorage,
    getSnapshot,
    getServerSnapshot,
  );

  const setOpen = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const value = typeof next === "function" ? next(open) : next;
      try {
        window.localStorage.setItem(storageKey, value ? "1" : "0");
        // 같은 탭의 다른 CollapsibleSection 인스턴스에도 알림
        window.dispatchEvent(new Event("te:localstorage"));
      } catch {}
    },
    [open, storageKey],
  );

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group flex w-full items-center gap-2 rounded-md px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronDown
          className={`size-4 text-text-tertiary transition-transform duration-150 ${
            open ? "" : "-rotate-90"
          }`}
          aria-hidden="true"
        />
        <div className="flex-1">{summary}</div>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}
