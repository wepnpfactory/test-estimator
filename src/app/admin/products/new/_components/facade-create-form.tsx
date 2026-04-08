"use client";

import { useEffect, useState } from "react";

interface Mall {
  id: string;
  name: string;
  mallId: string;
}

interface Category {
  categoryNo: number;
  categoryName: string;
  categoryDepth: number;
}

interface Props {
  malls: Mall[];
  action: (formData: FormData) => Promise<void>;
}

export function FacadeCreateForm({ malls, action }: Props) {
  const [mallId, setMallId] = useState(malls[0]?.id ?? "");
  const [name, setName] = useState("");
  const [price, setPrice] = useState(0);
  const [summary, setSummary] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [categoryNo, setCategoryNo] = useState<number | "">("");
  const [display, setDisplay] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [template, setTemplate] = useState<"NONE" | "BOOKLET" | "FLAT_PRINT">(
    "FLAT_PRINT",
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!mallId) return;
    fetch(`/api/admin/cafe24/${mallId}/categories`)
      .then((r) => r.json())
      .then((d) => setCategories(d.categories || []))
      .catch(() => setCategories([]));
  }, [mallId]);

  async function onSubmit(formData: FormData) {
    setSubmitting(true);
    try {
      await action(formData);
    } catch (err) {
      const digest = (err as { digest?: string } | null)?.digest;
      if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
        throw err;
      }
      console.error("[facade-create-form] failed:", err);
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = mallId && name.trim() && price >= 0;

  return (
    <form action={onSubmit} className="space-y-6">
      <input type="hidden" name="mallId" value={mallId} />
      <input type="hidden" name="template" value={template} />
      <Section title="① 몰 선택">
        <select
          value={mallId}
          onChange={(e) => setMallId(e.target.value)}
          className={inputCls}
        >
          {malls.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.mallId})
            </option>
          ))}
        </select>
      </Section>

      <Section
        title="② 상품 종류"
        hint="선택한 종류에 맞는 옵션 그룹이 자동으로 생성됩니다."
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(
            [
              { v: "BOOKLET", title: "책자", desc: "사이즈·페이지·표지·내지·제본" },
              { v: "FLAT_PRINT", title: "낱장 인쇄", desc: "명함·포스터" },
              { v: "NONE", title: "빈 상품", desc: "직접 추가" },
            ] as const
          ).map((t) => {
            const active = template === t.v;
            return (
              <button
                key={t.v}
                type="button"
                onClick={() => setTemplate(t.v)}
                className={
                  "rounded-lg border px-3 py-2.5 text-left transition " +
                  (active
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                    : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900")
                }
              >
                <div className="text-xs font-semibold">{t.title}</div>
                <div
                  className={
                    "mt-0.5 text-[10px] " +
                    (active
                      ? "text-zinc-300 dark:text-zinc-600"
                      : "text-zinc-500")
                  }
                >
                  {t.desc}
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      <Section
        title="③ 새 디스플레이 상품 정보"
        hint="Cafe24에 새로 등록할 진열용 상품의 기본 정보입니다."
      >
        <Field label="상품명">
          <input
            name="productName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={inputCls}
          />
        </Field>
        <Field label="기본가 (원)">
          <input
            name="price"
            type="number"
            value={price}
            min={0}
            onChange={(e) => setPrice(Math.max(0, Number(e.target.value) || 0))}
            className={inputCls + " tabular-nums"}
          />
          <p className="mt-1 text-[11px] text-zinc-500">
            카탈로그 노출용 최저가/기본가입니다. 실제 결제는 옵션 선택 후 동적 상품으로 처리됩니다.
          </p>
        </Field>
        <Field label="요약 설명">
          <textarea
            name="summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={2}
            className={inputCls}
          />
        </Field>
        <Field label="대표 이미지 URL (선택)">
          <input
            name="imageUrl"
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
            className={inputCls}
          />
        </Field>
        <Field label="카테고리">
          <select
            name="categoryNo"
            value={categoryNo}
            onChange={(e) =>
              setCategoryNo(e.target.value ? Number(e.target.value) : "")
            }
            className={inputCls}
          >
            <option value="">선택 안 함</option>
            {categories
              .sort((a, b) => a.categoryNo - b.categoryNo)
              .map((c) => (
                <option key={c.categoryNo} value={c.categoryNo}>
                  {"  ".repeat(Math.max(0, c.categoryDepth - 1))}
                  {c.categoryName} (#{c.categoryNo})
                </option>
              ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            name="display"
            checked={display}
            onChange={(e) => setDisplay(e.target.checked)}
            className="h-4 w-4"
          />
          진열 (목록·검색 노출)
        </label>
        <input type="hidden" name="displayValue" value={display ? "T" : "F"} />
      </Section>

      <button
        type="submit"
        disabled={!canSubmit || submitting}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300 dark:bg-white dark:text-zinc-900 dark:disabled:bg-zinc-700"
      >
        {submitting ? "Cafe24에 등록 중…" : "Cafe24에 상품 만들기 + 연결"}
      </button>
    </form>
  );
}

const inputCls =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">
        {label}
      </span>
      {children}
    </label>
  );
}
