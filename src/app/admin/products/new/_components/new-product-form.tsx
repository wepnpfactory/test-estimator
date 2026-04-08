"use client";

import { useState } from "react";
import { Cafe24ProductPicker } from "./cafe24-product-picker";

interface Mall {
  id: string;
  name: string;
  mallId: string;
}

interface Props {
  malls: Mall[];
  action: (formData: FormData) => Promise<void>;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function NewProductForm({ malls, action }: Props) {
  const [mallId, setMallId] = useState(malls[0]?.id ?? "");
  const [picked, setPicked] = useState<{
    productNo: number;
    productName: string;
    price: string;
  } | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [basePrice, setBasePrice] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  function handlePick(p: {
    productNo: number;
    productName: string;
    price: string;
  }) {
    setPicked(p);
    if (!name) setName(p.productName);
    if (!slug) setSlug(slugify(p.productName).slice(0, 80));
    setBasePrice(Math.round(Number(p.price) || 0));
  }

  async function onSubmit(formData: FormData) {
    setSubmitting(true);
    try {
      await action(formData);
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = mallId && picked && name.trim() && slug.trim();

  return (
    <form action={onSubmit} className="space-y-6">
      <input type="hidden" name="mallId" value={mallId} />
      <input type="hidden" name="cafe24ProductNo" value={picked?.productNo ?? ""} />
      <input type="hidden" name="basePrice" value={basePrice} />

      <Section title="① 몰 선택">
        <select
          value={mallId}
          onChange={(e) => {
            setMallId(e.target.value);
            setPicked(null);
          }}
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
        title="② Cafe24 디스플레이 상품 선택"
        hint="이미 쇼핑몰에 등록된 상품 중에서 견적 엔진을 붙일 상품을 선택합니다."
      >
        {mallId ? (
          <Cafe24ProductPicker
            mallDbId={mallId}
            onSelect={handlePick}
            selectedProductNo={picked?.productNo ?? null}
          />
        ) : (
          <div className="text-xs text-zinc-500">먼저 몰을 선택하세요.</div>
        )}
      </Section>

      <Section title="③ 견적 엔진 설정">
        <Field label="상품명 (관리용)">
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={inputCls}
          />
        </Field>
        <Field label="slug (URL용)">
          <input
            name="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
            className={inputCls + " font-mono"}
          />
        </Field>
        <Field label="기본가 (원)">
          <input
            type="number"
            value={basePrice}
            onChange={(e) => setBasePrice(Number(e.target.value) || 0)}
            className={inputCls + " tabular-nums"}
          />
          <p className="mt-1 text-[11px] text-zinc-500">
            옵션 추가금액이 더해지는 기본 단가입니다. 선택한 Cafe24 상품가로 자동 채워집니다.
          </p>
        </Field>
      </Section>

      <button
        type="submit"
        disabled={!canSubmit || submitting}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300 dark:bg-white dark:text-zinc-900 dark:disabled:bg-zinc-700"
      >
        {submitting ? "생성 중…" : "생성"}
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
