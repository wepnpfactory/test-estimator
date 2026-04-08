"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  {
    href: "/admin",
    label: "대시보드",
    icon: (
      <path d="M3 12l9-9 9 9M5 10v10h4v-6h6v6h4V10" />
    ),
  },
  {
    href: "/admin/products",
    label: "상품 연결",
    icon: (
      <path d="M20 7L12 3 4 7v10l8 4 8-4V7zM4 7l8 4m0 0l8-4m-8 4v10" />
    ),
  },
  {
    href: "/admin/malls",
    label: "몰 연동",
    icon: (
      <path d="M3 9l9-6 9 6v11a1 1 0 01-1 1h-5v-7H10v7H5a1 1 0 01-1-1V9z" />
    ),
  },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5 px-3 py-3 text-sm">
      {NAV.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={
              "group relative flex items-center gap-2.5 rounded-md px-3 py-2 font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-900 " +
              (active
                ? "bg-zinc-100 text-zinc-900 before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-r-full before:bg-zinc-900 dark:bg-zinc-800 dark:text-zinc-50 dark:before:bg-zinc-100"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100")
            }
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={
                active
                  ? "text-zinc-900 dark:text-zinc-50"
                  : "text-zinc-400 group-hover:text-zinc-600 dark:text-zinc-500 dark:group-hover:text-zinc-300"
              }
            >
              {item.icon}
            </svg>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
