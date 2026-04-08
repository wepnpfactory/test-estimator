import Link from "next/link";
import type { ReactNode } from "react";

const NAV = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/products", label: "상품 연결" },
  { href: "/admin/malls", label: "몰 연동" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <aside className="w-56 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="px-5 py-5 text-sm font-semibold">test-estimator</div>
        <nav className="flex flex-col px-2 py-2 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-sm text-zinc-600 dark:text-zinc-400">관리자</div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
