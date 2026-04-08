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
  const [open, setOpen] = useState(defaultOpen);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved !== null) setOpen(saved === "1");
    } catch {}
    setHydrated(true);
  }, [storageKey]);

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
        className="group flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
      >
        <ChevronDown
          className={`size-4 text-zinc-400 transition-transform duration-150 ${
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
