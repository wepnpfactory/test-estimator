import type { ReactNode } from "react";
import { labelCaptionCls } from "../form-styles";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={labelCaptionCls}>{label}</span>
      {children}
      {hint && (
        <span className="text-[11px] text-text-tertiary">{hint}</span>
      )}
    </div>
  );
}

const KIND_BADGE_MAP: Record<string, { cls: string; label: string }> = {
  SHEET_COUNT: { cls: "bg-info/10 text-info", label: "페이지수" },
  QUANTITY: { cls: "bg-warning/10 text-warning", label: "부수" },
  DIMENSIONS: { cls: "bg-brand/10 text-brand", label: "사이즈" },
  INNER_PAPER: { cls: "bg-success/10 text-success", label: "내지 종이" },
  COVER_PAPER: { cls: "bg-success/10 text-success", label: "표지 종이" },
};

export function KindBadge({ kind }: { kind: string }) {
  if (kind === "NORMAL") return null;
  const m = KIND_BADGE_MAP[kind];
  if (!m) return null;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${m.cls}`}
    >
      {m.label}
    </span>
  );
}
