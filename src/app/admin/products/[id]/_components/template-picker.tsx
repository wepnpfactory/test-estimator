"use client";

import { useState, useTransition } from "react";

type Template = "NONE" | "BOOKLET" | "FLAT_PRINT";

interface Props {
  productId: string;
  current: Template;
  hasGroups: boolean;
  action: (productId: string, formData: FormData) => Promise<void>;
}

const OPTIONS: { v: Template; label: string }[] = [
  { v: "BOOKLET", label: "책자" },
  { v: "FLAT_PRINT", label: "낱장 인쇄" },
  { v: "NONE", label: "빈 상품" },
];

export function TemplatePicker({
  productId,
  current,
  hasGroups,
  action,
}: Props) {
  const [value, setValue] = useState<Template>(current);
  const [pending, startTransition] = useTransition();

  function submit() {
    const fd = new FormData();
    fd.set("template", value);
    startTransition(async () => {
      try {
        await action(productId, fd);
      } catch (err) {
        const digest = (err as { digest?: string } | null)?.digest;
        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
          throw err;
        }
        console.error("[template-picker]", err);
      }
    });
  }

  const dirty = value !== current;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
      <span className="text-zinc-500">상품 종류</span>
      {OPTIONS.map((t) => {
        const active = value === t.v;
        return (
          <button
            key={t.v}
            type="button"
            onClick={() => setValue(t.v)}
            className={
              "rounded border px-2.5 py-1 transition " +
              (active
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                : "border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800")
            }
          >
            {t.label}
          </button>
        );
      })}
      <button
        type="button"
        onClick={submit}
        disabled={!dirty || pending}
        className="rounded bg-zinc-200 px-2 py-0.5 disabled:opacity-50 dark:bg-zinc-700"
      >
        {pending ? "저장 중…" : "저장"}
      </button>
      {!hasGroups && value !== "NONE" && dirty && (
        <span className="text-zinc-400">
          저장하면 선택한 종류의 옵션 그룹이 자동 생성됩니다
        </span>
      )}
    </div>
  );
}
