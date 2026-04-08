"use client";

import { useState, useTransition } from "react";

interface Preset {
  label: string;
  w: number;
  h: number;
}

// 책자 — 도서/잡지 표준 사이즈
const BOOKLET_PRESETS: Preset[] = [
  { label: "A6 (105×148)", w: 105, h: 148 },
  { label: "B6 (128×182)", w: 128, h: 182 },
  { label: "신국판 (152×225)", w: 152, h: 225 },
  { label: "크라운판 (176×248)", w: 176, h: 248 },
  { label: "A5 (148×210)", w: 148, h: 210 },
  { label: "B5 (182×257)", w: 182, h: 257 },
  { label: "A4 (210×297)", w: 210, h: 297 },
];

// 낱장 인쇄 — 명함/엽서/포스터 표준 사이즈
const FLAT_PRESETS: Preset[] = [
  { label: "명함 (90×50)", w: 90, h: 50 },
  { label: "명함 (85×55)", w: 85, h: 55 },
  { label: "엽서 (100×148)", w: 100, h: 148 },
  { label: "엽서 (102×152)", w: 102, h: 152 },
  { label: "A6 (105×148)", w: 105, h: 148 },
  { label: "A5 (148×210)", w: 148, h: 210 },
  { label: "B5 (182×257)", w: 182, h: 257 },
  { label: "A4 (210×297)", w: 210, h: 297 },
  { label: "B4 (257×364)", w: 257, h: 364 },
  { label: "A3 (297×420)", w: 297, h: 420 },
  { label: "B3 (364×515)", w: 364, h: 515 },
  { label: "A2 (420×594)", w: 420, h: 594 },
  { label: "B2 (515×728)", w: 515, h: 728 },
];

const ALL_PRESETS: Preset[] = Array.from(
  new Map(
    [...BOOKLET_PRESETS, ...FLAT_PRESETS].map((p) => [p.label, p]),
  ).values(),
);

function getPresets(template: string): Preset[] {
  if (template === "BOOKLET") return BOOKLET_PRESETS;
  if (template === "FLAT_PRINT") return FLAT_PRESETS;
  return ALL_PRESETS;
}

interface Props {
  productId: string;
  current: number;
  bleed: number;
  template: string;
  action: (productId: string, formData: FormData) => Promise<void>;
}

function findMatchingPreset(area: number, presets: Preset[]): Preset | undefined {
  return presets.find((p) => p.w * p.h === area);
}

export function BaseAreaForm({
  productId,
  current,
  bleed,
  template,
  action,
}: Props) {
  const presets = getPresets(template);
  const [w, setW] = useState<number>(() => {
    const m = findMatchingPreset(current, ALL_PRESETS);
    return m ? m.w : Math.round(Math.sqrt(current));
  });
  const [h, setH] = useState<number>(() => {
    const m = findMatchingPreset(current, ALL_PRESETS);
    return m ? m.h : Math.round(Math.sqrt(current));
  });
  const [bleedMm, setBleedMm] = useState<number>(bleed);
  const [pending, startTransition] = useTransition();
  const area = w * h;

  function applyPreset(label: string) {
    const p = ALL_PRESETS.find((x) => x.label === label);
    if (p) {
      setW(p.w);
      setH(p.h);
    }
  }

  async function onSubmit(formData: FormData) {
    formData.set("baseAreaMm2", String(area));
    formData.set("bleedMm", String(bleedMm));
    startTransition(async () => {
      try {
        await action(productId, formData);
      } catch (err) {
        const digest = (err as { digest?: string } | null)?.digest;
        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
          throw err;
        }
      }
    });
  }

  return (
    <form
      action={onSubmit}
      className="mt-2 flex flex-wrap items-center gap-2 text-[11px]"
    >
      <span className="text-zinc-500">기준 사이즈</span>
      <select
        onChange={(e) => applyPreset(e.target.value)}
        defaultValue=""
        className="rounded border border-zinc-300 bg-white px-1.5 py-0.5 dark:border-zinc-700 dark:bg-zinc-900"
      >
        <option value="">
          프리셋 ({template === "BOOKLET"
            ? "책자"
            : template === "FLAT_PRINT"
              ? "낱장"
              : "전체"}
          )
        </option>
        {presets.map((p) => (
          <option key={p.label} value={p.label}>
            {p.label}
          </option>
        ))}
      </select>
      <input
        type="number"
        value={w}
        onChange={(e) => setW(Math.max(1, Number(e.target.value) || 1))}
        className="w-16 rounded border border-zinc-300 px-1.5 py-0.5 text-right dark:border-zinc-700 dark:bg-zinc-900"
      />
      <span className="text-zinc-400">×</span>
      <input
        type="number"
        value={h}
        onChange={(e) => setH(Math.max(1, Number(e.target.value) || 1))}
        className="w-16 rounded border border-zinc-300 px-1.5 py-0.5 text-right dark:border-zinc-700 dark:bg-zinc-900"
      />
      <span className="text-zinc-400">mm</span>
      <span className="font-mono text-zinc-500">
        = {area.toLocaleString()}mm²
      </span>
      <span className="text-zinc-400">·</span>
      <label className="flex items-center gap-1 text-zinc-500">
        도련
        <input
          type="number"
          value={bleedMm}
          min={0}
          onChange={(e) => setBleedMm(Math.max(0, Number(e.target.value) || 0))}
          className="w-12 rounded border border-zinc-300 px-1.5 py-0.5 text-right dark:border-zinc-700 dark:bg-zinc-900"
        />
        mm
      </label>
      <button
        disabled={pending}
        className="rounded bg-zinc-200 px-2 py-0.5 dark:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "저장 중…" : "저장"}
      </button>
      <span className="text-zinc-400">
        면적 비례 가격 계산의 기준 (perArea 옵션의 분모)
      </span>
    </form>
  );
}
