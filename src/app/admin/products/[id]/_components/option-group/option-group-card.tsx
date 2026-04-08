import { ChevronDown, ChevronUp, X } from "lucide-react";
import { CollapsibleSection } from "../collapsible-section";
import { buttonCls, buttonGhostCls, inputCls } from "../form-styles";
import { OptionBulkPaste } from "../option-bulk-paste";
import { KindBadge } from "./field";
import { OptionGroupSettings } from "./option-group-settings";
import { OptionItemRow } from "./option-item-row";
import { OptionItemHeader } from "./option-item-header";
import type { OptionGroupActions, OptionGroupWithItems } from "./types";

const inputFull = inputCls + " w-full";

interface Props {
  productId: string;
  group: OptionGroupWithItems;
  index: number;
  total: number;
  /** 같은 상품의 모든 그룹 (sortOrder 오름차순). 조건 선택용. */
  allGroups: OptionGroupWithItems[];
  actions: OptionGroupActions;
}

function fmtSigned(n: number): string {
  return `${n > 0 ? "+" : ""}${n.toLocaleString()}`;
}

export function OptionGroupCard({
  productId,
  group,
  index,
  total,
  allGroups,
  actions,
}: Props) {
  // 현재 그룹보다 sortOrder 가 앞선 그룹들만 조건 후보로 사용
  const precedingGroups = allGroups.filter(
    (g) => g.sortOrder < group.sortOrder,
  );
  const itemCount = group.items.length;
  const addPrices = group.items.map((i) => i.addPrice);
  const minAdd = addPrices.length ? Math.min(...addPrices) : 0;
  const maxAdd = addPrices.length ? Math.max(...addPrices) : 0;
  const priceRange = !itemCount
    ? "—"
    : minAdd === maxAdd
      ? `${fmtSigned(minAdd)}원`
      : `${fmtSigned(minAdd)} ~ ${fmtSigned(maxAdd)}원`;

  const summary = (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="truncate text-sm font-semibold text-foreground">
        {group.name}
      </span>
      <KindBadge kind={group.kind} />
      {group.required && (
        <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
          필수
        </span>
      )}
      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-text-secondary">
        {itemCount}개
      </span>
      <span className="ms-auto tabular-nums text-[11px] font-medium text-text-secondary">
        {priceRange}
      </span>
    </div>
  );

  return (
    <div className="rounded-xl border border-border bg-card shadow-(--shadow-card)">
      <div className="flex items-center gap-2 px-3 py-3">
        {/* 순서 변경 */}
        <div className="flex flex-col gap-1.5">
          <form
            action={actions.moveGroup.bind(null, productId, group.id, "up")}
          >
            <button
              type="submit"
              disabled={index === 0}
              className="flex size-6 items-center justify-center rounded text-text-tertiary hover:bg-surface-subtle hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
              aria-label="위로"
            >
              <ChevronUp className="size-3.5" aria-hidden />
            </button>
          </form>
          <form
            action={actions.moveGroup.bind(null, productId, group.id, "down")}
          >
            <button
              type="submit"
              disabled={index === total - 1}
              className="flex size-6 items-center justify-center rounded text-text-tertiary hover:bg-surface-subtle hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
              aria-label="아래로"
            >
              <ChevronDown className="size-3.5" aria-hidden />
            </button>
          </form>
        </div>

        <div className="min-w-0 flex-1">
          <CollapsibleSection
            storageKey={`optgrp:${productId}:${group.id}`}
            summary={summary}
          >
            <div className="space-y-3 border-t border-border pt-3">
              <OptionGroupSettings
                productId={productId}
                group={group}
                precedingGroups={precedingGroups}
                actions={actions}
              />

              {/* 페이지수·부수 직접 입력 그룹은 아이템 목록 숨김 — 숫자 입력만으로 동작 */}
              {(() => {
                const hideItems =
                  (group.kind === "SHEET_COUNT" ||
                    group.kind === "QUANTITY") &&
                  group.allowDirectInput;
                if (hideItems) {
                  return (
                    <div className="rounded-md border border-dashed border-border px-3 py-3 text-center text-[11px] text-text-tertiary">
                      직접 입력 모드 — 사용자가 숫자를 직접 입력합니다 (옵션 값 불필요)
                    </div>
                  );
                }
                return (
                  <>
                    {/* 옵션 아이템 목록 */}
                    {itemCount === 0 ? (
                      <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-[11px] text-text-tertiary">
                        아직 추가된 값이 없습니다
                      </div>
                    ) : (
                      <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
                        <OptionItemHeader group={group} />
                        {group.items.map((it, ii) => (
                          <OptionItemRow
                            key={it.id}
                            productId={productId}
                            group={group}
                            item={it}
                            index={ii}
                            total={itemCount}
                            precedingGroups={precedingGroups}
                            actions={actions}
                          />
                        ))}
                      </ul>
                    )}

                    {/* 새 아이템 추가 */}
                    <form
                      action={actions.addItem.bind(null, group.id, productId)}
                      className="grid grid-cols-[1fr_1fr_7rem_auto] gap-2"
                    >
                      <input
                        name="label"
                        placeholder="표시명"
                        className={inputFull}
                      />
                      <input
                        name="value"
                        placeholder="value"
                        className={inputFull}
                      />
                      <input
                        name="addPrice"
                        type="number"
                        placeholder="추가금액"
                        className={inputFull}
                      />
                      <button className={buttonGhostCls}>추가</button>
                    </form>

                    <OptionBulkPaste
                      groupId={group.id}
                      productId={productId}
                      bulkAction={actions.bulkAddItems}
                    />
                  </>
                );
              })()}
            </div>
          </CollapsibleSection>
        </div>

        <form action={actions.deleteGroup.bind(null, productId, group.id)}>
          <button
            type="submit"
            aria-label="그룹 삭제"
            title="그룹 삭제"
            className="flex size-7 shrink-0 items-center justify-center rounded text-text-tertiary hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="size-4" aria-hidden />
          </button>
        </form>
      </div>
    </div>
  );
}

interface AddFormProps {
  productId: string;
  action: (productId: string, formData: FormData) => Promise<void>;
}

export function AddOptionGroupForm({ productId, action }: AddFormProps) {
  return (
    <form action={action.bind(null, productId)} className="mt-4 flex gap-2">
      <input
        name="name"
        placeholder="새 옵션 그룹 이름 (예: 표지 재질)"
        className={inputCls + " flex-1"}
      />
      <button className={buttonCls}>+ 그룹 추가</button>
    </form>
  );
}
