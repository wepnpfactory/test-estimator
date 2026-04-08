// 가격 계산 + 조건부 가시성 평가
//
// 모델:
// - OptionGroup.kind: NORMAL | SHEET_COUNT | QUANTITY
//     SHEET_COUNT 그룹의 selected item.multiplier → 장수
//     QUANTITY    그룹의 selected item.multiplier → 부수
// - OptionItem.perSheet/perQuantity: 이 item의 addPrice 를 sheets/qty 에 곱함
// - OptionGroup.showWhen: [{groupId, itemId}, ...] AND. 빈 값이면 항상 노출.
//
// 계산:
//   sheets = SHEET_COUNT 그룹의 selected.multiplier (없으면 1)
//   qty    = QUANTITY    그룹의 selected.multiplier (없으면 1)
//   total  = basePrice
//   for each visible+selected item:
//     c = item.addPrice
//     if perSheet:    c *= sheets
//     if perQuantity: c *= qty
//     total += c

import type {
  Product,
  OptionGroup,
  OptionItem,
} from "@/generated/prisma/client";

export type ProductWithOptions = Product & {
  optionGroups: (OptionGroup & { items: OptionItem[] })[];
};

export interface SelectedOption {
  groupId: string;
  itemId: string;
}

export interface QuoteResult {
  basePrice: number;
  optionsAddPrice: number;
  finalPrice: number;
  sheets: number;
  quantity: number;
  resolvedItems: {
    groupName: string;
    label: string;
    addPrice: number;
    contribution: number; // perSheet/perQuantity 곱셈 반영된 실제 가산
  }[];
  visibleGroupIds: string[];
  errors: string[];
}

interface ShowWhenCondition {
  groupId: string;
  itemId: string;
}

function parseShowWhen(value: unknown): ShowWhenCondition[] {
  if (!Array.isArray(value)) return [];
  const out: ShowWhenCondition[] = [];
  for (const v of value) {
    if (
      v &&
      typeof v === "object" &&
      typeof (v as ShowWhenCondition).groupId === "string" &&
      typeof (v as ShowWhenCondition).itemId === "string"
    ) {
      out.push({
        groupId: (v as ShowWhenCondition).groupId,
        itemId: (v as ShowWhenCondition).itemId,
      });
    }
  }
  return out;
}

/**
 * 현재 selections 와 그룹의 showWhen 으로 가시성 평가.
 * showWhen 이 비어있으면 항상 visible.
 */
export function isGroupVisible(
  group: OptionGroup,
  selections: SelectedOption[],
): boolean {
  const conditions = parseShowWhen(group.showWhen);
  if (conditions.length === 0) return true;
  return conditions.every((c) =>
    selections.some(
      (sel) => sel.groupId === c.groupId && sel.itemId === c.itemId,
    ),
  );
}

export function calculateQuote(
  product: ProductWithOptions,
  rawSelections: SelectedOption[],
): QuoteResult {
  const errors: string[] = [];
  const groupById = new Map(product.optionGroups.map((g) => [g.id, g]));

  // 1. 가시 그룹 결정 (showWhen 평가) — 숨겨진 그룹의 selection 은 무시
  //    showWhen 은 다른 그룹의 selection 에 의존하므로, 한 번 통과로는 부족할 수 있다.
  //    fixed-point loop: 최대 N회 반복.
  let visibleGroupIds = new Set<string>();
  let activeSelections = rawSelections;
  for (let i = 0; i < 5; i++) {
    const next = new Set<string>();
    for (const g of product.optionGroups) {
      if (isGroupVisible(g, activeSelections)) next.add(g.id);
    }
    activeSelections = rawSelections.filter((s) => next.has(s.groupId));
    if (
      next.size === visibleGroupIds.size &&
      [...next].every((id) => visibleGroupIds.has(id))
    ) {
      visibleGroupIds = next;
      break;
    }
    visibleGroupIds = next;
  }

  // 2. selection 검증
  const seenGroups = new Set<string>();
  const validatedItems: { group: OptionGroup; item: OptionItem }[] = [];
  for (const sel of activeSelections) {
    const group = groupById.get(sel.groupId);
    if (!group) {
      errors.push(`unknown groupId: ${sel.groupId}`);
      continue;
    }
    if (seenGroups.has(group.id)) {
      errors.push(`duplicate selection for group: ${group.name}`);
      continue;
    }
    seenGroups.add(group.id);
    const item = group.items.find((i) => i.id === sel.itemId);
    if (!item) {
      errors.push(`unknown itemId in group ${group.name}: ${sel.itemId}`);
      continue;
    }
    if (!item.enabled) {
      errors.push(`item disabled: ${item.label}`);
      continue;
    }
    validatedItems.push({ group, item });
  }

  // 3. 필수 그룹 검증 (가시 그룹만)
  for (const g of product.optionGroups) {
    if (!visibleGroupIds.has(g.id)) continue;
    if (g.required && !seenGroups.has(g.id)) {
      errors.push(`required group not selected: ${g.name}`);
    }
  }

  // 4. sheets / qty 결정
  let sheets = 1;
  let quantity = 1;
  for (const { group, item } of validatedItems) {
    if (group.kind === "SHEET_COUNT") sheets = item.multiplier || 1;
    if (group.kind === "QUANTITY") quantity = item.multiplier || 1;
  }

  // 5. 합계 계산
  let optionsAddPrice = 0;
  const resolvedItems: QuoteResult["resolvedItems"] = [];
  for (const { group, item } of validatedItems) {
    let c = item.addPrice;
    if (group.perSheet) c *= sheets;
    if (group.perQuantity) c *= quantity;
    optionsAddPrice += c;
    resolvedItems.push({
      groupName: group.name,
      label: item.label,
      addPrice: item.addPrice,
      contribution: c,
    });
  }

  return {
    basePrice: product.basePrice,
    optionsAddPrice,
    finalPrice: product.basePrice + optionsAddPrice,
    sheets,
    quantity,
    resolvedItems,
    visibleGroupIds: [...visibleGroupIds],
    errors,
  };
}
