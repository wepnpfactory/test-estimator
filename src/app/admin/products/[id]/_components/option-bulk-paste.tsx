"use client";

import { useState, useTransition } from "react";

export interface ParsedItem {
  label: string;
  value: string;
  addPrice: number;
}

export function parseBulkOptions(text: string): {
  items: ParsedItem[];
  errors: string[];
} {
  const errors: string[] = [];
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/) // 빈 줄로 블록 분리
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  const items: ParsedItem[] = [];
  blocks.forEach((block, idx) => {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length < 3) {
      errors.push(`블록 ${idx + 1}: 3줄(label/value/addPrice) 미만 — 건너뜀`);
      return;
    }
    const [label, value, priceStr] = lines;
    const addPrice = Number(priceStr);
    if (!Number.isFinite(addPrice)) {
      errors.push(`블록 ${idx + 1} (${label}): 가격이 숫자가 아님 (${priceStr})`);
      return;
    }
    if (!/^[a-z0-9_-]+$/i.test(value)) {
      errors.push(
        `블록 ${idx + 1} (${label}): value 는 영숫자/하이픈/언더스코어만 가능 (${value})`,
      );
      return;
    }
    items.push({ label, value, addPrice });
  });
  return { items, errors };
}

interface Props {
  groupId: string;
  productId: string;
  bulkAction: (
    groupId: string,
    productId: string,
    items: ParsedItem[],
  ) => Promise<void>;
}

export function OptionBulkPaste({ groupId, productId, bulkAction }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  const { items, errors } = parseBulkOptions(text);

  function submit() {
    if (items.length === 0) return;
    startTransition(async () => {
      await bulkAction(groupId, productId, items);
      setText("");
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        + 벌크 붙여넣기
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-md border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="flex items-center justify-between text-[11px] text-zinc-500">
        <span>
          블록당 3줄 (label / value / addPrice). 빈 줄로 블록 구분.
        </span>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setText("");
          }}
          className="text-zinc-400 hover:text-zinc-600"
        >
          닫기
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        spellCheck={false}
        placeholder={`A4 (210×297)\na4\n0\n\nB5 (182×257)\nb5\n-2000`}
        className="block w-full rounded-md border border-zinc-300 bg-white p-2 font-mono text-[12px] leading-snug dark:border-zinc-700 dark:bg-zinc-900"
      />
      <div className="flex items-center justify-between text-[11px]">
        <div className="text-zinc-500">
          파싱: <strong className="text-zinc-700 dark:text-zinc-300">{items.length}건</strong>
          {errors.length > 0 && (
            <span className="ml-2 text-rose-600">에러 {errors.length}</span>
          )}
        </div>
        <button
          type="button"
          disabled={items.length === 0 || pending}
          onClick={submit}
          className="rounded-md bg-zinc-900 px-3 py-1 text-[11px] font-medium text-white disabled:bg-zinc-300 dark:bg-white dark:text-zinc-900 dark:disabled:bg-zinc-700"
        >
          {pending ? "추가 중…" : `${items.length}건 일괄 추가`}
        </button>
      </div>
      {errors.length > 0 && (
        <ul className="space-y-0.5 text-[11px] text-rose-600">
          {errors.slice(0, 5).map((e, i) => (
            <li key={i}>· {e}</li>
          ))}
          {errors.length > 5 && <li>… 외 {errors.length - 5}건</li>}
        </ul>
      )}
    </div>
  );
}
