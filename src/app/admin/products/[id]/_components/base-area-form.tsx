"use client";

import { useState, useTransition } from "react";
import { buttonCls, inputCls, labelCaptionCls } from "./form-styles";

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
  new Map([...BOOKLET_PRESETS, ...FLAT_PRESETS].map((p) => [p.label, p])).values()
);

interface Props {
  productId: string;
  current: number;
  bleed: number;
  leadTimeDays: number;
  template: string;
  action: (productId: string, formData: FormData) => Promise<void>;
}

function findMatchingPreset(area: number, presets: Preset[]): Preset | undefined {
  return presets.find((p) => p.w * p.h === area);
}

export function BaseAreaForm({ productId, current, bleed, leadTimeDays, template, action }: Props) {
  const [w, setW] = useState<number>(() => {
    const m = findMatchingPreset(current, ALL_PRESETS);
    return m ? m.w : Math.round(Math.sqrt(current));
  });
  const [h, setH] = useState<number>(() => {
    const m = findMatchingPreset(current, ALL_PRESETS);
    return m ? m.h : Math.round(Math.sqrt(current));
  });
  const [bleedMm, setBleedMm] = useState<number>(bleed);
  const [leadTime, setLeadTime] = useState<number>(leadTimeDays);
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
    formData.set("leadTimeDays", String(leadTime));
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
    <form action={onSubmit} className="mt-3 flex flex-wrap items-center gap-2">
      <span className={labelCaptionCls}>기준 사이즈</span>
      <select onChange={(e) => applyPreset(e.target.value)} defaultValue="" className={inputCls + " w-44"}>
        <option value="">프리셋 선택</option>
        {(template === "BOOKLET" || template === "NONE") && (
          <optgroup label="📖 책자">
            {BOOKLET_PRESETS.map((p) => (
              <option key={`b-${p.label}`} value={p.label}>
                {p.label}
              </option>
            ))}
          </optgroup>
        )}
        {(template === "FLAT_PRINT" || template === "NONE") && (
          <optgroup label="📄 낱장 인쇄">
            {FLAT_PRESETS.map((p) => (
              <option key={`f-${p.label}`} value={p.label}>
                {p.label}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <input
        type="number"
        value={w}
        onChange={(e) => setW(Math.max(1, Number(e.target.value) || 1))}
        className={inputCls + " w-16 text-right"}
      />
      <span className="text-xs text-text-tertiary">×</span>
      <input
        type="number"
        value={h}
        onChange={(e) => setH(Math.max(1, Number(e.target.value) || 1))}
        className={inputCls + " w-16 text-right"}
      />
      <span className="text-xs text-text-secondary">mm</span>
      <span className="font-mono text-xs text-text-secondary">= {area.toLocaleString()}mm²</span>
      <span className="text-xs text-text-disabled">·</span>
      <label className="flex items-center gap-1.5 text-xs text-text-secondary">
        도련
        <input
          type="number"
          value={bleedMm}
          min={0}
          onChange={(e) => setBleedMm(Math.max(0, Number(e.target.value) || 0))}
          className={inputCls + " w-14 text-right"}
        />
        mm
      </label>
      <label className="flex items-center gap-1.5 text-xs text-text-secondary">
        제작기간
        <input
          type="number"
          value={leadTime}
          min={0}
          onChange={(e) => setLeadTime(Math.max(0, Number(e.target.value) || 0))}
          className={inputCls + " w-14 text-right"}
        />
        영업일
      </label>
      <button disabled={pending} className={buttonCls}>
        {pending ? "저장 중…" : "저장"}
      </button>
      <span className="text-[11px] text-text-tertiary">면적 비례 가격 계산의 기준 (perArea 옵션의 분모)</span>
    </form>
  );
}
