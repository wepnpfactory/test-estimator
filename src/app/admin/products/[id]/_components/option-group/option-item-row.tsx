"use client";

import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { buttonGhostCls, inputCls } from "../form-styles";
import { ConditionPicker, parseConditions, useConditionPatch } from "./condition-picker";
import type { OptionGroupActions, OptionGroupWithItems, OptionItemRow as OptionItemRowType } from "./types";

interface Props {
  productId: string;
  group: OptionGroupWithItems;
  item: OptionItemRowType;
  index: number;
  total: number;
  precedingGroups: OptionGroupWithItems[];
  actions: OptionGroupActions;
}

function priceSuffix(group: OptionGroupWithItems): string {
  const parts: string[] = [];
  if (group.perSheet) parts.push("×장");
  if (group.perQuantity) parts.push("×부");
  if (group.perArea) parts.push("×면적");
  return parts.join(" ");
}

/**
 * 셀 한 칸 — 평소엔 값만 보여주고, 클릭/포커스 시 input 활성화.
 * blur/Enter 시 해당 필드 하나만 patch 로 저장한다.
 */
function Cell({
  name,
  defaultValue,
  display,
  type = "text",
  placeholder,
  width = "w-full",
  align = "left",
  step,
  min,
  patch,
}: {
  name: string;
  defaultValue: string | number | null | undefined;
  display: ReactNode;
  type?: "text" | "number" | "url";
  placeholder?: string;
  width?: string;
  align?: "left" | "right" | "center";
  step?: string;
  min?: number;
  patch: (name: string, value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState<string>(defaultValue == null ? "" : String(defaultValue));
  const inputRef = useRef<HTMLInputElement>(null);

  const alignCls = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";

  function commit() {
    setEditing(false);
    const original = defaultValue == null ? "" : String(defaultValue);
    if (val !== original) patch(name, val);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        step={step}
        min={min}
        value={val}
        placeholder={placeholder}
        autoFocus
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            setVal(defaultValue == null ? "" : String(defaultValue));
            setEditing(false);
          }
        }}
        className={`${inputCls} ${width} ${alignCls} h-7 px-1.5`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`flex h-7 ${width} items-center ${alignCls === "text-left" ? "justify-start" : alignCls === "text-right" ? "justify-end" : "justify-center"} rounded px-1.5 text-xs hover:bg-surface-muted/60 focus:bg-surface-muted/60 focus:outline-none`}
    >
      {display}
    </button>
  );
}

export function OptionItemRow({ productId, group, item, index, total, precedingGroups, actions }: Props) {
  const [, startTransition] = useTransition();
  const isSheetQty = group.kind === "SHEET_COUNT" || group.kind === "QUANTITY";
  const showMultiplier = isSheetQty && !group.allowDirectInput;
  const showRange = isSheetQty && group.allowDirectInput;
  const showDims = group.kind === "DIMENSIONS";
  const showThickness = group.kind === "INNER_PAPER" || group.kind === "COVER_PAPER";
  const showImage = group.displayType === "SWATCH";
  const showFacets = group.displayType === "CASCADE";
  const suffix = priceSuffix(group);

  function patch(name: string, value: string) {
    const fd = new FormData();
    fd.set(name, value);
    startTransition(() => {
      void actions.updateItem(productId, item.id, fd);
    });
  }

  return (
    <li className="flex items-center gap-1 bg-surface-subtle px-2 py-1 text-xs">
      <div className="flex flex-col">
        <form action={actions.moveItem.bind(null, productId, group.id, item.id, "up")}>
          <button
            type="submit"
            disabled={index === 0}
            className="flex size-5 items-center justify-center rounded text-text-tertiary hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            aria-label="위로"
          >
            <ChevronUp className="size-3" aria-hidden />
          </button>
        </form>
        <form action={actions.moveItem.bind(null, productId, group.id, item.id, "down")}>
          <button
            type="submit"
            disabled={index === total - 1}
            className="flex size-5 items-center justify-center rounded text-text-tertiary hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            aria-label="아래로"
          >
            <ChevronDown className="size-3" aria-hidden />
          </button>
        </form>
      </div>

      {/* CASCADE 1차/2차 */}
      {showFacets && (
        <>
          <div className="w-24">
            <Cell
              name="facetA"
              defaultValue={item.facetA}
              placeholder={group.facetALabel ?? "1차"}
              display={
                <span className="truncate text-foreground">
                  {item.facetA || <span className="text-text-disabled">{group.facetALabel ?? "1차"}</span>}
                </span>
              }
              patch={patch}
            />
          </div>
          <div className="w-20">
            <Cell
              name="facetB"
              defaultValue={item.facetB}
              placeholder={group.facetBLabel ?? "2차"}
              display={
                <span className="truncate text-foreground">
                  {item.facetB || <span className="text-text-disabled">{group.facetBLabel ?? "2차"}</span>}
                </span>
              }
              patch={patch}
            />
          </div>
        </>
      )}

      {/* label */}
      <div className="min-w-0 flex-1">
        <Cell
          name="label"
          defaultValue={item.label}
          display={<span className="truncate font-medium text-foreground">{item.label}</span>}
          width="w-full"
          patch={patch}
        />
      </div>

      {/* value */}
      <div className="w-24">
        <Cell
          name="value"
          defaultValue={item.value}
          display={<span className="truncate font-mono text-[11px] text-text-tertiary">{item.value}</span>}
          patch={patch}
        />
      </div>

      {/* addPrice — DIMENSIONS 그룹은 가격을 가지지 않음 (용지 그룹의 perArea 곱셈으로 결정) */}
      {!showDims && (
        <div className="w-32">
          <Cell
            name="addPrice"
            defaultValue={item.addPrice}
            type="number"
            align="right"
            display={
              <span className="tabular-nums text-text-secondary">
                {item.addPrice > 0 ? "+" : ""}
                {item.addPrice.toLocaleString()}원
                {suffix && <span className="ms-0.5 text-text-tertiary">{suffix}</span>}
              </span>
            }
            patch={patch}
          />
        </div>
      )}

      {/* context fields */}
      {showMultiplier && (
        <div className="w-16">
          <Cell
            name="multiplier"
            defaultValue={item.multiplier}
            type="number"
            align="right"
            display={<span className="tabular-nums text-text-secondary">×{item.multiplier}</span>}
            patch={patch}
          />
        </div>
      )}
      {showRange && (
        <>
          <div className="w-14">
            <Cell
              name="minRange"
              defaultValue={item.minRange}
              type="number"
              align="right"
              placeholder="min"
              display={<span className="tabular-nums text-text-tertiary">{item.minRange ?? "—"}</span>}
              patch={patch}
            />
          </div>
          <span className="text-text-disabled">~</span>
          <div className="w-14">
            <Cell
              name="maxRange"
              defaultValue={item.maxRange}
              type="number"
              align="right"
              placeholder="max"
              display={<span className="tabular-nums text-text-tertiary">{item.maxRange ?? "—"}</span>}
              patch={patch}
            />
          </div>
        </>
      )}
      {showDims && (
        <>
          <div className="w-14">
            <Cell
              name="widthMm"
              defaultValue={item.widthMm}
              type="number"
              align="right"
              display={<span className="tabular-nums text-text-tertiary">{item.widthMm ?? "—"}</span>}
              patch={patch}
            />
          </div>
          <span className="text-text-disabled">×</span>
          <div className="w-14">
            <Cell
              name="heightMm"
              defaultValue={item.heightMm}
              type="number"
              align="right"
              display={<span className="tabular-nums text-text-tertiary">{item.heightMm ?? "—"}</span>}
              patch={patch}
            />
          </div>
          <span className="text-[10px] text-text-disabled">mm</span>
        </>
      )}
      {showThickness && (
        <div className="w-16">
          <Cell
            name="thicknessMm"
            defaultValue={item.thicknessMm}
            type="number"
            step="0.001"
            align="right"
            display={
              <span className="tabular-nums text-text-tertiary">
                {item.thicknessMm != null ? `${item.thicknessMm}mm` : "—"}
              </span>
            }
            patch={patch}
          />
        </div>
      )}

      {/* disabledWhen — 모달로 선행 옵션 선택 */}
      <div className="flex w-20 justify-end">
        <DisabledWhenCell item={item} precedingGroups={precedingGroups} patch={patch} />
      </div>

      {/* leadTime 칼럼 — 항상 노출, 입력 없을 땐 dash */}
      <div className="w-16">
        <Cell
          name="leadTimeDays"
          defaultValue={item.leadTimeDays}
          type="number"
          min={0}
          align="right"
          display={
            item.leadTimeDays > 0 ? (
              <span className="tabular-nums text-brand">+{item.leadTimeDays}일</span>
            ) : (
              <span className="text-text-disabled">—</span>
            )
          }
          patch={patch}
        />
      </div>

      {/* SWATCH image url */}
      {showImage && (
        <div className="w-32">
          <Cell
            name="imageUrl"
            defaultValue={item.imageUrl}
            type="url"
            display={<span className="truncate text-[11px] text-text-tertiary">{item.imageUrl || "이미지…"}</span>}
            patch={patch}
          />
        </div>
      )}

      <form action={actions.deleteItem.bind(null, productId, item.id)}>
        <button
          type="submit"
          aria-label="삭제"
          className="flex size-6 items-center justify-center rounded text-text-tertiary hover:bg-destructive/10 hover:text-destructive"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </form>
    </li>
  );
}

// buttonGhostCls 는 더 이상 쓰지 않지만 re-export 호환용으로 보관
void buttonGhostCls;

function DisabledWhenCell({
  item,
  precedingGroups,
  patch,
}: {
  item: OptionItemRowType;
  precedingGroups: OptionGroupWithItems[];
  patch: (name: string, value: string) => void;
}) {
  const value = parseConditions(item.disabledWhen);
  const { apply, pending } = useConditionPatch("disabledWhen", patch);
  return (
    <ConditionPicker
      title="비활성 조건"
      value={value}
      precedingGroups={precedingGroups}
      onChange={apply}
      pending={pending}
    />
  );
}
