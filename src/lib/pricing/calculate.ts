// 가격 계산 + 조건부 가시성 + 직접 입력 + 면적 비례
//
// 모델 (Phase 1):
// - OptionGroup.kind: NORMAL | SHEET_COUNT | QUANTITY | DIMENSIONS
//     SHEET_COUNT  → 장수 (sheets)
//     QUANTITY     → 부수 (qty)
//     DIMENSIONS   → 면적 (mm²)
// - allowDirectInput: SHEET_COUNT/QUANTITY 그룹이 숫자 직접 입력 받음
//     - 입력값이 그룹 내 OptionItem.minRange/maxRange 에 매칭되는 첫 아이템 자동 선택
//     - sheets/qty 는 사용자 입력값 그대로
// - DIMENSIONS: W/H mm 직접 입력 → widthMm/heightMm fit 옵션 자동 선택, 면적은 입력값
// - perSheet/perQuantity/perArea: 그룹 단위 곱셈 플래그
// - showWhen: 그룹·아이템 단위 조건부 노출
//
// 계산:
//   sheets   = SHEET_COUNT 그룹이 있으면 그 값, 없으면 1
//   qty      = QUANTITY    그룹이 있으면 그 값, 없으면 1
//   areaRatio= DIMENSIONS  그룹이 있으면 (입력 W×H) / Product.baseAreaMm2, 없으면 1
//   total    = basePrice
//   for each visible+selected item:
//     c = item.addPrice
//     if group.perSheet:    c *= sheets
//     if group.perQuantity: c *= qty
//     if group.perArea:     c *= areaRatio
//     total += c

import type { Product, OptionGroup, OptionItem } from "@/generated/prisma/client";

export type ProductWithOptions = Product & {
  optionGroups: (OptionGroup & { items: OptionItem[] })[];
};

export interface SelectedOption {
  groupId: string;
  itemId?: string | null;
  /** SHEET_COUNT/QUANTITY 직접 입력 값 */
  directValue?: number | null;
  /** DIMENSIONS 직접 입력 값 */
  widthMm?: number | null;
  heightMm?: number | null;
}

export interface QuoteResult {
  basePrice: number;
  optionsAddPrice: number;
  finalPrice: number;
  sheets: number;
  quantity: number;
  areaMm2: number;
  areaRatio: number;
  /** 표지 계산용 — 자동 산출된 책등 두께(mm) */
  spineMm: number;
  /** 표지 전개 면적(mm²) — (2×trimW + spine + 2×bleed) × (trimH + 2×bleed) */
  coverAreaMm2: number;
  /** 표지 면적 / Product.baseAreaMm2 */
  coverAreaRatio: number;
  /** 총 영업일 (Product.leadTimeDays + 선택 옵션 max leadTime) */
  leadTimeDays: number;
  resolvedItems: {
    groupName: string;
    label: string;
    addPrice: number;
    contribution: number;
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

function isVisible(showWhen: unknown, selections: SelectedOption[]): boolean {
  const conditions = parseShowWhen(showWhen);
  if (conditions.length === 0) return true;
  return conditions.every((c) => selections.some((sel) => sel.groupId === c.groupId && sel.itemId === c.itemId));
}

export function isGroupVisible(group: OptionGroup, selections: SelectedOption[]): boolean {
  return isVisible(group.showWhen, selections);
}

/** 아이템 disabledWhen 평가 — 조건 만족 시 disabled(선택 불가) */
export function isItemDisabled(item: OptionItem, selections: SelectedOption[]): boolean {
  const conditions = parseShowWhen(item.disabledWhen);
  if (conditions.length === 0) return false;
  return conditions.every((c) => selections.some((sel) => sel.groupId === c.groupId && sel.itemId === c.itemId));
}

/** SHEET_COUNT/QUANTITY 직접 입력 값에 매칭되는 첫 옵션 */
function findRangeItem(items: OptionItem[], value: number): OptionItem | null {
  const sorted = [...items].filter((i) => i.enabled).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  for (const it of sorted) {
    const min = it.minRange ?? -Infinity;
    const max = it.maxRange ?? Infinity;
    if (value >= min && value <= max) return it;
  }
  return null;
}

/** DIMENSIONS W/H 입력에 fit 되는 가장 작은 옵션 */
function findFitDimensionItem(items: OptionItem[], w: number, h: number): OptionItem | null {
  const candidates = items
    .filter((i) => i.enabled)
    .filter((i) => {
      const fitW = i.widthMm == null || i.widthMm >= w;
      const fitH = i.heightMm == null || i.heightMm >= h;
      return fitW && fitH;
    });
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const aw = a.widthMm ?? Infinity;
    const ah = a.heightMm ?? Infinity;
    const bw = b.widthMm ?? Infinity;
    const bh = b.heightMm ?? Infinity;
    return aw * ah - bw * bh;
  });
  return candidates[0];
}

export function calculateQuote(product: ProductWithOptions, rawSelections: SelectedOption[]): QuoteResult {
  const errors: string[] = [];
  const groupById = new Map(product.optionGroups.map((g) => [g.id, g]));

  // 1. 가시 그룹 결정 (showWhen 평가) — fixed-point loop
  let visibleGroupIds = new Set<string>();
  let activeSelections = rawSelections;
  for (let i = 0; i < 5; i++) {
    const next = new Set<string>();
    for (const g of product.optionGroups) {
      if (isGroupVisible(g, activeSelections)) next.add(g.id);
    }
    activeSelections = rawSelections.filter((s) => next.has(s.groupId));
    if (next.size === visibleGroupIds.size && [...next].every((id) => visibleGroupIds.has(id))) {
      visibleGroupIds = next;
      break;
    }
    visibleGroupIds = next;
  }

  // 2. 각 selection → resolved item 결정
  //    - 그룹에 따라 itemId 직접 / 직접입력값으로 range 매칭 / W·H 로 fit 매칭
  //    - multiSelect 그룹은 같은 그룹에 복수 selection 허용
  const seenGroups = new Set<string>();
  const dimInputByGroup = new Map<string, { w: number; h: number }>();
  const resolved: {
    group: OptionGroup;
    item: OptionItem;
    sheetsValue?: number;
    qtyValue?: number;
    areaMm2?: number;
    dimW?: number;
    dimH?: number;
  }[] = [];

  for (const sel of activeSelections) {
    const group = groupById.get(sel.groupId);
    if (!group) {
      errors.push(`unknown groupId: ${sel.groupId}`);
      continue;
    }
    if (seenGroups.has(group.id) && !group.multiSelect) {
      errors.push(`duplicate selection for group: ${group.name}`);
      continue;
    }
    seenGroups.add(group.id);

    // (a) DIMENSIONS — W/H 입력 → 면적
    if (group.kind === "DIMENSIONS") {
      const w = sel.widthMm ?? 0;
      const h = sel.heightMm ?? 0;
      // 그룹의 maxWidthMm / maxHeightMm 상한 검증
      if (group.maxWidthMm != null && w > group.maxWidthMm) {
        errors.push(`${group.name}: 최대 가로 ${group.maxWidthMm}mm 까지 입력할 수 있습니다`);
        continue;
      }
      if (group.maxHeightMm != null && h > group.maxHeightMm) {
        errors.push(`${group.name}: 최대 세로 ${group.maxHeightMm}mm 까지 입력할 수 있습니다`);
        continue;
      }
      if (w > 0 && h > 0) {
        const item = findFitDimensionItem(group.items, w, h);
        if (!item) {
          errors.push(`no fit dimension item in ${group.name}`);
          continue;
        }
        if (isItemDisabled(item, activeSelections)) {
          errors.push(`item disabled by current selection: ${item.label}`);
          continue;
        }
        dimInputByGroup.set(group.id, { w, h });
        resolved.push({
          group,
          item,
          areaMm2: w * h,
          dimW: w,
          dimH: h,
        });
      } else if (sel.itemId) {
        const item = group.items.find((i) => i.id === sel.itemId);
        if (item) {
          const iw = item.widthMm ?? 0;
          const ih = item.heightMm ?? 0;
          resolved.push({
            group,
            item,
            areaMm2: iw * ih,
            dimW: iw,
            dimH: ih,
          });
        }
      }
      continue;
    }

    // (b) SHEET_COUNT / QUANTITY with allowDirectInput — 직접 입력 + range 매칭
    if ((group.kind === "SHEET_COUNT" || group.kind === "QUANTITY") && group.allowDirectInput) {
      const v = sel.directValue ?? 0;
      if (!Number.isFinite(v) || v <= 0) {
        errors.push(`required direct input missing: ${group.name}`);
        continue;
      }
      if (group.minDirectInput != null && v < group.minDirectInput) {
        errors.push(`${group.name}: 최소 ${group.minDirectInput} 이상 입력해야 합니다`);
        continue;
      }
      if (group.maxDirectInput != null && v > group.maxDirectInput) {
        errors.push(`${group.name}: 최대 ${group.maxDirectInput} 까지 입력할 수 있습니다`);
        continue;
      }
      // range 옵션 매칭 (없으면 가상 아이템)
      const item = findRangeItem(group.items, v);
      if (item) {
        if (isItemDisabled(item, activeSelections)) {
          errors.push(`item disabled: ${item.label}`);
          continue;
        }
        resolved.push({
          group,
          item,
          sheetsValue: group.kind === "SHEET_COUNT" ? v : undefined,
          qtyValue: group.kind === "QUANTITY" ? v : undefined,
        });
      } else {
        // range 가 정의된 아이템이 없거나 매칭 실패 — 가산 0 짜리 가상 아이템으로 처리
        resolved.push({
          group,
          item: {
            id: `_virtual_${group.id}`,
            groupId: group.id,
            label: `${v}`,
            value: String(v),
            addPrice: 0,
            multiplier: v,
            perSheet: false as never,
            perQuantity: false as never,
            widthMm: null,
            heightMm: null,
            minRange: null,
            maxRange: null,
            disabledWhen: null,
            stock: null,
            imageUrl: null,
            sortOrder: 0,
            enabled: true,
            thicknessMm: null,
            leadTimeDays: 0,
          } as unknown as OptionItem,
          sheetsValue: group.kind === "SHEET_COUNT" ? v : undefined,
          qtyValue: group.kind === "QUANTITY" ? v : undefined,
        });
      }
      continue;
    }

    // (c) 일반 — itemId 로 옵션 찾기
    if (!sel.itemId) {
      errors.push(`itemId missing for group: ${group.name}`);
      continue;
    }
    const item = group.items.find((i) => i.id === sel.itemId);
    if (!item) {
      errors.push(`unknown itemId in group ${group.name}: ${sel.itemId}`);
      continue;
    }
    if (!item.enabled) {
      errors.push(`item disabled: ${item.label}`);
      continue;
    }
    if (isItemDisabled(item, activeSelections)) {
      errors.push(`item disabled by current selection: ${item.label}`);
      continue;
    }
    resolved.push({ group, item });
  }

  // 3. 필수 그룹 검증
  for (const g of product.optionGroups) {
    if (!visibleGroupIds.has(g.id)) continue;
    if (g.required && !seenGroups.has(g.id)) {
      errors.push(`required group not selected: ${g.name}`);
    }
  }

  // 4. sheets / qty / area 결정
  let sheets = 1;
  let quantity = 1;
  let areaMm2 = 0;
  let trimW = 0;
  let trimH = 0;
  for (const r of resolved) {
    if (r.sheetsValue != null) sheets = r.sheetsValue;
    else if (r.group.kind === "SHEET_COUNT") sheets = r.item.multiplier || 1;
    if (r.qtyValue != null) quantity = r.qtyValue;
    else if (r.group.kind === "QUANTITY") quantity = r.item.multiplier || 1;
    if (r.areaMm2 != null && r.areaMm2 > 0) areaMm2 = r.areaMm2;
    else if (r.group.kind === "DIMENSIONS" && r.item.widthMm && r.item.heightMm) {
      areaMm2 = r.item.widthMm * r.item.heightMm;
    }
    if (r.dimW && r.dimH) {
      trimW = r.dimW;
      trimH = r.dimH;
    } else if (r.group.kind === "DIMENSIONS" && r.item.widthMm && r.item.heightMm) {
      trimW = r.item.widthMm;
      trimH = r.item.heightMm;
    }
  }
  const baseArea = product.baseAreaMm2 || 1;
  const areaRatio = areaMm2 > 0 ? areaMm2 / baseArea : 1;

  // 4-b. 책등 두께 & 표지 면적 자동 계산
  //     spine = 물리 sheet 수(sheets/2) × 내지 장당 두께(mm)
  //     coverW = trimW × 2 + spine + bleed × 2
  //     coverH = trimH + bleed × 2
  let innerThicknessMm = 0;
  for (const r of resolved) {
    if (r.group.kind === "INNER_PAPER" && r.item.thicknessMm) {
      innerThicknessMm = r.item.thicknessMm;
    }
  }
  const physicalSheets = Math.max(1, Math.ceil(sheets / 2));
  const spineMm = innerThicknessMm > 0 ? physicalSheets * innerThicknessMm : 0;
  const bleed = product.bleedMm || 0;
  let coverAreaMm2 = 0;
  if (trimW > 0 && trimH > 0) {
    const coverW = trimW * 2 + spineMm + bleed * 2;
    const coverH = trimH + bleed * 2;
    coverAreaMm2 = coverW * coverH;
  }
  const coverAreaRatio = coverAreaMm2 > 0 ? coverAreaMm2 / baseArea : areaRatio;

  // 5. 합계 계산 + lead time 집계
  //    perArea 는 COVER_PAPER 그룹에선 coverAreaRatio 를 사용
  let optionsAddPrice = 0;
  let maxOptionLeadTime = 0;
  const resolvedItems: QuoteResult["resolvedItems"] = [];
  for (const r of resolved) {
    let c = r.item.addPrice;
    if (r.group.perSheet) c *= sheets;
    if (r.group.perQuantity) c *= quantity;
    if (r.group.perArea) {
      const isCover = r.group.kind === "COVER_PAPER";
      c *= isCover ? coverAreaRatio : areaRatio;
    }
    optionsAddPrice += c;
    if (r.item.leadTimeDays && r.item.leadTimeDays > maxOptionLeadTime) {
      maxOptionLeadTime = r.item.leadTimeDays;
    }
    resolvedItems.push({
      groupName: r.group.name,
      label: r.item.label,
      addPrice: r.item.addPrice,
      contribution: Math.round(c),
    });
  }

  const leadTimeDays = (product.leadTimeDays || 0) + maxOptionLeadTime;

  return {
    basePrice: product.basePrice,
    optionsAddPrice: Math.round(optionsAddPrice),
    finalPrice: Math.round(product.basePrice + optionsAddPrice),
    sheets,
    quantity,
    areaMm2,
    areaRatio,
    spineMm,
    coverAreaMm2,
    coverAreaRatio,
    leadTimeDays,
    resolvedItems,
    visibleGroupIds: [...visibleGroupIds],
    errors,
  };
}
