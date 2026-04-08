import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-8 dark:bg-zinc-950">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          test-estimator
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Cafe24 가변 옵션 상품 관리 · 동적 상품 생성 서비스
        </p>
        <Link
          href="/admin"
          className="mt-6 inline-flex items-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          관리자 페이지로 이동
        </Link>
      </div>
    </div>
  );
}
