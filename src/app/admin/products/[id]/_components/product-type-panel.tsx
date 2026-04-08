"use client";

import { useState, useTransition } from "react";
import { buttonCls, inputCls, labelCaptionCls } from "./form-styles";

type Template = "NONE" | "BOOKLET" | "FLAT_PRINT";

interface Preset {
  label: string;
  w: number;
  h: number;
}

const BOOKLET_PRESETS: Preset[] = [
  { label: "A6 (105×148)", w: 105, h: 148 },
  { label: "B6 (128×182)", w: 128, h: 182 },
  { label: "신국판 (152×225)", w: 152, h: 225 },
  { label: "크라운판 (176×248)", w: 176, h: 248 },
  { label: "A5 (148×210)", w: 148, h: 210 },
  { label: "B5 (182×257)", w: 182, h: 257 },
  { label: "A4 (210×297)", w: 210, h: 297 },
];

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

const OPTIONS: { v: Template; label: string }[] = [
  { v: "BOOKLET", label: "책자" },
  { v: "FLAT_PRINT", label: "낱장 인쇄" },
  { v: "NONE", label: "빈 상품" },
];

interface Props {
  productId: string;
  initialTemplate: Template;
  hasGroups: boolean;
  baseAreaMm2: number;
  bleedMm: number;
  leadTimeDays: number;
  templateAction: (productId: string, formData: FormData) => Promise<void>;
  resetAction: (productId: string) => Promise<void>;
  metaAction: (productId: string, formData: FormData) => Promise<void>;
}

export function ProductTypePanel({
  productId,
  initialTemplate,
  hasGroups,
  baseAreaMm2,
  bleedMm,
  leadTimeDays,
  templateAction,
  resetAction,
  metaAction,
}: Props) {
  const [template, setTemplate] = useState<Template>(initialTemplate);
  const initMatch = ALL_PRESETS.find((p) => p.w * p.h === baseAreaMm2);
  const [w, setW] = useState<number>(initMatch ? initMatch.w : Math.round(Math.sqrt(baseAreaMm2)));
  const [h, setH] = useState<number>(initMatch ? initMatch.h : Math.round(Math.sqrt(baseAreaMm2)));
  const [bleed, setBleed] = useState<number>(bleedMm);
  const [lead, setLead] = useState<number>(leadTimeDays);
  const [pending, startTransition] = useTransition();
  const [resetPending, startResetTransition] = useTransition();

  const area = w * h;

  function applyPreset(label: string) {
    const p = ALL_PRESETS.find((x) => x.label === label);
    if (p) {
      setW(p.w);
      setH(p.h);
    }
  }

  async function save() {
    startTransition(async () => {
      try {
        // 1. template 우선 저장 (그룹 자동 스캐폴드 트리거 가능)
        if (template !== initialTemplate) {
          const tfd = new FormData();
          tfd.set("template", template);
          await templateAction(productId, tfd);
        }
        // 2. base area / bleed / leadTime 저장
        const mfd = new FormData();
        mfd.set("baseAreaMm2", String(area));
        mfd.set("bleedMm", String(bleed));
        mfd.set("leadTimeDays", String(lead));
        await metaAction(productId, mfd);
      } catch (err) {
        const digest = (err as { digest?: string } | null)?.digest;
        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
          throw err;
        }
        console.error("[product-type-panel]", err);
      }
    });
  }

  function doReset() {
    if (template === "NONE") return;
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
        console.error("[product-type-panel:reset]", err);
      }
    });
  }

  const templateDirty = template !== initialTemplate;
  const metaDirty = area !== baseAreaMm2 || bleed !== bleedMm || lead !== leadTimeDays;
  const dirty = templateDirty || metaDirty;

  return (
    <div className="mt-3 space-y-2">
      {/* 상품 종류 라디오 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={labelCaptionCls}>상품 종류</span>
        <div className="inline-flex h-8 divide-x divide-border overflow-hidden rounded-md border border-border bg-card">
          {OPTIONS.map((t) => {
            const active = template === t.v;
            return (
              <button
                key={t.v}
                type="button"
                onClick={() => setTemplate(t.v)}
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
        {initialTemplate !== "NONE" && hasGroups && (
          <button
            type="button"
            onClick={doReset}
            disabled={resetPending}
            className="inline-flex h-8 items-center rounded-md border border-destructive/40 px-3 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
            title="기존 옵션 그룹을 모두 삭제하고 템플릿 기본값으로 초기화"
          >
            {resetPending ? "초기화 중…" : "템플릿으로 초기화"}
          </button>
        )}
      </div>

      {/* 기준 사이즈 + 도련 + 제작기간 */}
      <div className="flex flex-wrap items-center gap-2">
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
            value={bleed}
            min={0}
            onChange={(e) => setBleed(Math.max(0, Number(e.target.value) || 0))}
            className={inputCls + " w-14 text-right"}
          />
          mm
        </label>
        <label className="flex items-center gap-1.5 text-xs text-text-secondary">
          제작기간
          <input
            type="number"
            value={lead}
            min={0}
            onChange={(e) => setLead(Math.max(0, Number(e.target.value) || 0))}
            className={inputCls + " w-14 text-right"}
          />
          영업일
        </label>
        <button type="button" onClick={save} disabled={!dirty || pending} className={buttonCls}>
          {pending ? "저장 중…" : "저장"}
        </button>
      </div>
    </div>
  );
}
