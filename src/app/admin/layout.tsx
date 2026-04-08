import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SidebarNav } from "./_components/sidebar-nav";

export const metadata: Metadata = {
  title: {
    default: "관리자",
    template: "관리자 · %s",
  },
  description: "test-estimator 관리자 콘솔 — Cafe24 상품·옵션·주문 동기화 관리.",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <aside className="flex w-60 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex h-14 items-center gap-2 border-b border-zinc-200 px-5 dark:border-zinc-800">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-zinc-900 to-zinc-600 text-[10px] font-bold text-white dark:from-white dark:to-zinc-400 dark:text-zinc-900">
            TE
          </div>
          <div className="text-sm font-semibold tracking-tight">test-estimator</div>
        </div>
        <SidebarNav />
        <div className="mt-auto border-t border-zinc-200 px-5 py-3 text-[11px] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
          v0.1 · admin
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white/80 px-6 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
          <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            관리자
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            A
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
