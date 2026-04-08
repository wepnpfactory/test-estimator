// MVP 가격 계산: 기본가 + 선택된 옵션의 addPrice 합산
// PriceRule 엔진은 후속 작업

import type { Product, OptionGroup, OptionItem } from "@/generated/prisma/client";

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
  resolvedItems: { groupName: string; label: string; addPrice: number }[];
  errors: string[];
}

export function calculateQuote(
  product: ProductWithOptions,
  selections: SelectedOption[],
): QuoteResult {
  const errors: string[] = [];
  const resolvedItems: QuoteResult["resolvedItems"] = [];
  let optionsAddPrice = 0;

  const groupById = new Map(product.optionGroups.map((g) => [g.id, g]));
  const seenGroups = new Set<string>();

  for (const sel of selections) {
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
    optionsAddPrice += item.addPrice;
    resolvedItems.push({
      groupName: group.name,
      label: item.label,
      addPrice: item.addPrice,
    });
  }

  // 필수 그룹이 모두 선택되었는지 확인
  for (const g of product.optionGroups) {
    if (g.required && !seenGroups.has(g.id)) {
      errors.push(`required group not selected: ${g.name}`);
    }
  }

  return {
    basePrice: product.basePrice,
    optionsAddPrice,
    finalPrice: product.basePrice + optionsAddPrice,
    resolvedItems,
    errors,
  };
}
