"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

interface CollapsibleSectionProps {
  storageKey: string;
  defaultOpen?: boolean;
  summary: ReactNode;
  children: ReactNode;
}

/**
 * 서버 렌더링된 콘텐츠를 감싸는 접기/펼치기 래퍼.
 * open 상태는 storageKey 별로 localStorage에 유지된다.
 */
export function CollapsibleSection({
  storageKey,
  defaultOpen = true,
  summary,
  children,
}: CollapsibleSectionProps) {
  // SSR 시 defaultOpen 으로 시작 → hydration 후 localStorage 값으로 1회 동기화.
  // useState lazy initializer 에서 window 접근하면 hydration mismatch 가 나므로
  // 첫 렌더는 defaultOpen 으로 두고, useEffect 에서 한 번만 보정.
  const [open, setOpen] = useState(defaultOpen);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let next = defaultOpen;
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved !== null) next = saved === "1";
    } catch {}
    // 변경이 있을 때만 setState — 불필요한 cascade 방지
    setOpen((prev) => (prev === next ? prev : next));
    setHydrated(true);
  }, [storageKey, defaultOpen]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(storageKey, open ? "1" : "0");
    } catch {}
  }, [open, hydrated, storageKey]);

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
