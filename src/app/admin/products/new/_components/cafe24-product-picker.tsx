"use client";

import { useEffect, useState } from "react";

interface Cafe24Product {
  productNo: number;
  productCode: string;
  productName: string;
  price: string;
  display: string;
  selling: string;
  listImage?: string | null;
}

interface Props {
  mallDbId: string;
  onSelect: (p: Cafe24Product) => void;
  selectedProductNo: number | null;
}

export function Cafe24ProductPicker({ mallDbId, onSelect, selectedProductNo }: Props) {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Cafe24Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mallDbId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const t = setTimeout(() => {
      const url = new URL(
        `/api/admin/cafe24/${mallDbId}/products`,
        window.location.origin,
      );
      if (search.trim()) url.searchParams.set("search", search.trim());
      url.searchParams.set("limit", "20");
      fetch(url.toString())
        .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
        .then(({ ok, d }) => {
          if (cancelled) return;
          if (!ok) {
            setError(d.error || "조회 실패");
            setProducts([]);
          } else {
            setProducts(d.products || []);
          }
        })
        .catch(() => {
          if (!cancelled) setError("네트워크 오류");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [mallDbId, search]);

  return (
    <div className="space-y-3">
      <input
        type="search"
        placeholder="상품명으로 검색"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />

      {error && <div className="text-xs text-rose-600">{error}</div>}

      <div className="max-h-80 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-800">
        {loading && (
          <div className="px-3 py-6 text-center text-xs text-zinc-500">불러오는 중…</div>
        )}
        {!loading && products.length === 0 && !error && (
          <div className="px-3 py-6 text-center text-xs text-zinc-500">
            결과가 없습니다.
          </div>
        )}
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {products.map((p) => {
            const selected = selectedProductNo === p.productNo;
            const hidden = p.display === "F";
            return (
              <li key={p.productNo}>
                <button
                  type="button"
                  onClick={() => onSelect(p)}
                  className={
                    "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition " +
                    (selected
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60")
                  }
                >
                  {p.listImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.listImage}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 shrink-0 rounded bg-zinc-100 dark:bg-zinc-800" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{p.productName}</div>
                    <div
                      className={
                        "mt-0.5 flex items-center gap-2 text-[11px] " +
                        (selected
                          ? "text-zinc-200 dark:text-zinc-600"
                          : "text-zinc-500")
                      }
                    >
                      <span className="font-mono">#{p.productNo}</span>
                      <span>·</span>
                      <span className="tabular-nums">
                        {Number(p.price).toLocaleString()}원
                      </span>
                      {hidden && <span className="ml-1">· 진열X</span>}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
