import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { buttonCls, inputCls } from "../form-styles";
import { Field } from "./field";
import { GroupShowWhenPicker } from "./group-show-when-picker";
import type { OptionGroupActions, OptionGroupWithItems } from "./types";

const inputFull = inputCls + " w-full";

interface Props {
  productId: string;
  group: OptionGroupWithItems;
  precedingGroups: OptionGroupWithItems[];
  actions: OptionGroupActions;
}

export function OptionGroupSettings({ productId, group, precedingGroups, actions }: Props) {
  return (
    <details className="group rounded-md border border-border bg-surface-subtle">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-xs font-medium text-text-secondary hover:text-foreground">
        <span>고급 설정 (역할 · 필수 · 노출 조건)</span>
        <ChevronDown className="size-3.5 text-text-tertiary transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <form
        action={actions.updateGroup.bind(null, productId, group.id)}
        className="space-y-4 border-t border-border px-4 py-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="역할 (kind)">
            <select name="kind" defaultValue={group.kind} className={inputFull}>
              <option value="NORMAL">일반</option>
              <option value="SHEET_COUNT">페이지수 (sheet)</option>
              <option value="QUANTITY">부수 (quantity)</option>
              <option value="DIMENSIONS">사이즈 (가로×세로)</option>
              <option value="INNER_PAPER">내지 종이</option>
              <option value="COVER_PAPER">표지 종이</option>
            </select>
          </Field>
          <Field label="표시 타입 (displayType)">
            <select name="displayType" defaultValue={group.displayType} className={inputFull}>
              <option value="SELECT">SELECT — 드롭다운</option>
              <option value="RADIO">RADIO — 라디오 버튼</option>
              <option value="SWATCH">SWATCH — 이미지 카드</option>
              <option value="CHECKBOX">CHECKBOX — 다중 선택</option>
              <option value="NUMBER">NUMBER — 숫자 입력</option>
              <option value="CASCADE">CASCADE — 2단 셀렉트 (종이 → 평량)</option>
            </select>
          </Field>
        </div>

        {group.displayType === "CASCADE" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="1차 셀렉트 라벨" hint="예: 종이">
              <input
                name="facetALabel"
                defaultValue={group.facetALabel ?? ""}
                placeholder="종이"
                className={inputFull}
              />
            </Field>
            <Field label="2차 셀렉트 라벨" hint="예: 평량">
              <input
                name="facetBLabel"
                defaultValue={group.facetBLabel ?? ""}
                placeholder="평량"
                className={inputFull}
              />
            </Field>
          </div>
        )}

        <div className={`grid grid-cols-1 gap-4 ${group.displayType === "CHECKBOX" ? "sm:grid-cols-2" : ""}`}>
          <Field label="필수 여부">
            <label className="flex h-8 items-center gap-2 text-xs text-foreground">
              <input type="checkbox" name="required" defaultChecked={group.required} className="size-4" />
              필수 그룹
            </label>
          </Field>
          {group.displayType === "CHECKBOX" && (
            <Field label="다중 선택">
              <label className="flex h-8 items-center gap-2 text-xs text-foreground">
                <input type="checkbox" name="multiSelect" defaultChecked={group.multiSelect} className="size-4" />한
                그룹에서 복수 아이템 선택 허용
              </label>
            </Field>
          )}
        </div>

        {(group.kind === "NORMAL" || group.kind === "INNER_PAPER" || group.kind === "COVER_PAPER") && (
          <>
            <Field label="곱셈 옵션">
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                <CheckboxLabel
                  name="perSheet"
                  defaultChecked={group.perSheet}
                  label={
                    <>
                      <b>장수</b>에 곱함
                    </>
                  }
                />
                <CheckboxLabel
                  name="perQuantity"
                  defaultChecked={group.perQuantity}
                  label={
                    <>
                      <b>부수</b>에 곱함
                    </>
                  }
                />
                <CheckboxLabel
                  name="perArea"
                  defaultChecked={group.perArea}
                  label={
                    <>
                      <b>면적</b>에 곱함 (사이즈 그룹 필요)
                    </>
                  }
                />
              </div>
            </Field>
          </>
        )}

        {(group.kind === "SHEET_COUNT" || group.kind === "QUANTITY") && (
          <Field label="직접 입력 모드">
            <div className="space-y-2">
              <CheckboxLabel
                name="allowDirectInput"
                defaultChecked={group.allowDirectInput}
                label="사용자가 숫자 직접 입력 (옵션 셀렉트 대신)"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  name="minDirectInput"
                  defaultValue={group.minDirectInput ?? ""}
                  placeholder="최소"
                  className={inputFull}
                />
                <input
                  type="number"
                  name="maxDirectInput"
                  defaultValue={group.maxDirectInput ?? ""}
                  placeholder="최대"
                  className={inputFull}
                />
              </div>
              <p className="text-[11px] text-text-tertiary">
                옵션 아이템에 minRange/maxRange 를 정의하면 입력값에 따라 자동 매칭됩니다.
              </p>
            </div>
          </Field>
        )}

        <Field label="보이는 조건" hint="선행 옵션의 특정 값이 선택됐을 때만 이 그룹을 노출합니다. 비우면 항상 노출.">
          <GroupShowWhenPicker currentShowWhen={group.showWhen} precedingGroups={precedingGroups} />
        </Field>

        {group.kind === "DIMENSIONS" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="허용 최대 가로 (mm)">
              <input
                type="number"
                name="maxWidthMm"
                defaultValue={group.maxWidthMm ?? ""}
                placeholder="비우면 가장 큰 옵션 기준"
                className={inputFull}
              />
            </Field>
            <Field label="허용 최대 세로 (mm)">
              <input
                type="number"
                name="maxHeightMm"
                defaultValue={group.maxHeightMm ?? ""}
                placeholder="비우면 가장 큰 옵션 기준"
                className={inputFull}
              />
            </Field>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button type="submit" className={buttonCls}>
            설정 저장
          </button>
        </div>
      </form>
    </details>
  );
}

function CheckboxLabel({ name, defaultChecked, label }: { name: string; defaultChecked: boolean; label: ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-xs text-foreground">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-4" />
      {label}
    </label>
  );
}
