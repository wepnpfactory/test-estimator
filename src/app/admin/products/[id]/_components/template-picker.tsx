"use client";

import { useState, useTransition } from "react";
import { buttonCls, labelCaptionCls } from "./form-styles";

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
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className={labelCaptionCls}>상품 종류</span>
      <div className="inline-flex h-8 rounded-md border border-border bg-card p-0.5">
        {OPTIONS.map((t) => {
          const active = value === t.v;
          return (
            <button
              key={t.v}
              type="button"
              onClick={() => setValue(t.v)}
              className={
                "inline-flex h-7 items-center rounded px-3 text-xs font-medium transition-colors " +
                (active
                  ? "bg-primary text-primary-foreground"
                  : "text-text-secondary hover:bg-surface-subtle")
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={!dirty || pending}
        className={buttonCls}
      >
        {pending ? "저장 중…" : "저장"}
      </button>
      {!hasGroups && value !== "NONE" && dirty && (
        <span className="text-[11px] text-text-tertiary">
          저장하면 선택한 종류의 옵션 그룹이 자동 생성됩니다
        </span>
      )}
    </div>
  );
}
