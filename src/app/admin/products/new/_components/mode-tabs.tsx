"use client";

import { useState } from "react";

interface Props {
  link: React.ReactNode;
  create: React.ReactNode;
}

export function ModeTabs({ link, create }: Props) {
  const [mode, setMode] = useState<"link" | "create">("link");
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-1 text-xs font-medium dark:border-zinc-800 dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => setMode("link")}
          className={
            "rounded-md px-3 py-1.5 transition " +
            (mode === "link"
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400")
          }
        >
          기존 상품 연결
        </button>
        <button
          type="button"
          onClick={() => setMode("create")}
          className={
            "rounded-md px-3 py-1.5 transition " +
            (mode === "create"
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400")
          }
        >
          새 디스플레이 상품 만들기
        </button>
      </div>
      <div>{mode === "link" ? link : create}</div>
    </div>
  );
}
