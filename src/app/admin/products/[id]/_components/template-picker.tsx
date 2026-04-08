"use client";

import { useState, useTransition } from "react";
import { buttonCls, labelCaptionCls } from "./form-styles";

type Template = "NONE" | "BOOKLET" | "FLAT_PRINT";

interface Props {
  productId: string;
  current: Template;
  hasGroups: boolean;
  action: (productId: string, formData: FormData) => Promise<void>;
  resetAction?: (productId: string) => Promise<void>;
}

const OPTIONS: { v: Template; label: string }[] = [
  { v: "BOOKLET", label: "책자" },
  { v: "FLAT_PRINT", label: "낱장 인쇄" },
  { v: "NONE", label: "빈 상품" },
];

export function TemplatePicker({ productId, current, hasGroups, action, resetAction }: Props) {
  const [value, setValue] = useState<Template>(current);
  const [pending, startTransition] = useTransition();
  const [resetPending, startResetTransition] = useTransition();

  function resetFromTemplate() {
    if (!resetAction || current === "NONE") return;
    if (!window.confirm("현재 옵션 그룹을 모두 삭제하고 선택한 종류의 기본 옵션으로 초기화합니다. 계속하시겠어요?"))
      return;
    startResetTransition(async () => {
      try {
        await resetAction(productId);
      } catch (err) {
        const digest = (err as { digest?: string } | null)?.digest;
        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
          throw err;
        }
        console.error("[template-picker:reset]", err);
      }
    });
  }

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
      <div className="inline-flex h-8 divide-x divide-border overflow-hidden rounded-md border border-border bg-card">
        {OPTIONS.map((t) => {
          const active = value === t.v;
          return (
            <button
              key={t.v}
              type="button"
              onClick={() => setValue(t.v)}
              className={
                "inline-flex h-full min-w-16 items-center justify-center px-3 text-xs font-medium transition-colors " +
                (active ? "bg-primary text-primary-foreground" : "text-text-secondary hover:bg-surface-subtle")
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <button type="button" onClick={submit} disabled={!dirty || pending} className={buttonCls}>
        {pending ? "저장 중…" : "저장"}
      </button>
      {resetAction && current !== "NONE" && hasGroups && (
        <button
          type="button"
          onClick={resetFromTemplate}
          disabled={resetPending}
          className="inline-flex h-8 items-center rounded-md border border-destructive/40 px-3 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
          title="기존 옵션 그룹을 모두 삭제하고 템플릿 기본값으로 초기화합니다"
        >
          {resetPending ? "초기화 중…" : "템플릿으로 초기화"}
        </button>
      )}
      {!hasGroups && value !== "NONE" && dirty && (
        <span className="text-[11px] text-text-tertiary">저장하면 선택한 종류의 옵션 그룹이 자동 생성됩니다</span>
      )}
    </div>
  );
}
