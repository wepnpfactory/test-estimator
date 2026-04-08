// 상품 템플릿별 옵션 그룹 스캐폴드 정의
//
// 상품 등록 시 사용자가 선택한 템플릿에 따라 OptionGroup 들을 미리 생성한다.
// 옵션 아이템은 비어 있으며 관리자가 채워 넣는다.

import { prisma } from "@/lib/prisma";
import type { ProductTemplate } from "@/generated/prisma/client";

interface GroupSeed {
  name: string;
  value: string;
  kind: "NORMAL" | "SHEET_COUNT" | "QUANTITY" | "DIMENSIONS";
  required?: boolean;
  perSheet?: boolean;
  perQuantity?: boolean;
  perArea?: boolean;
  allowDirectInput?: boolean;
  minDirectInput?: number;
  maxDirectInput?: number;
  isInnerPaper?: boolean;
  isCoverPaper?: boolean;
}

const BOOKLET_GROUPS: GroupSeed[] = [
  { name: "사이즈", value: "size", kind: "DIMENSIONS", required: true },
  {
    name: "페이지수",
    value: "pages",
    kind: "SHEET_COUNT",
    required: true,
    allowDirectInput: true,
    minDirectInput: 2,
    maxDirectInput: 800,
  },
  {
    name: "수량",
    value: "qty",
    kind: "QUANTITY",
    required: true,
    allowDirectInput: true,
    minDirectInput: 1,
    maxDirectInput: 10000,
  },
  { name: "인쇄기", value: "press", kind: "NORMAL", required: true },
  { name: "제본", value: "binding", kind: "NORMAL", required: true },
  {
    name: "표지 종이",
    value: "cover_paper",
    kind: "NORMAL",
    required: true,
    perQuantity: true,
    perArea: true,
    isCoverPaper: true,
  },
  { name: "표지 인쇄면", value: "cover_side", kind: "NORMAL", required: true },
  { name: "표지 코팅", value: "cover_coating", kind: "NORMAL" },
  {
    name: "내지 종이",
    value: "inner_paper",
    kind: "NORMAL",
    required: true,
    perSheet: true,
    perQuantity: true,
    perArea: true,
    isInnerPaper: true,
  },
  { name: "내지 색도", value: "inner_color", kind: "NORMAL", required: true },
  { name: "내지 인쇄면", value: "inner_side", kind: "NORMAL", required: true },
  { name: "후가공", value: "finishing", kind: "NORMAL", perQuantity: true },
];

const FLAT_PRINT_GROUPS: GroupSeed[] = [
  { name: "사이즈", value: "size", kind: "DIMENSIONS", required: true },
  {
    name: "수량",
    value: "qty",
    kind: "QUANTITY",
    required: true,
    allowDirectInput: true,
    minDirectInput: 1,
    maxDirectInput: 100000,
  },
  { name: "인쇄기", value: "press", kind: "NORMAL", required: true },
  { name: "양면/단면", value: "side", kind: "NORMAL", required: true, perQuantity: true },
  {
    name: "용지",
    value: "paper",
    kind: "NORMAL",
    required: true,
    perQuantity: true,
    perArea: true,
  },
  { name: "색도", value: "ink", kind: "NORMAL", required: true, perQuantity: true },
  { name: "후가공", value: "finishing", kind: "NORMAL", perQuantity: true },
];

const TEMPLATES: Record<ProductTemplate, GroupSeed[]> = {
  NONE: [],
  BOOKLET: BOOKLET_GROUPS,
  FLAT_PRINT: FLAT_PRINT_GROUPS,
};

export async function scaffoldProductGroups(
  productId: string,
  template: ProductTemplate,
): Promise<void> {
  const groups = TEMPLATES[template] ?? [];
  if (groups.length === 0) return;
  await prisma.optionGroup.createMany({
    data: groups.map((g, idx) => ({
      productId,
      name: g.name,
      value: g.value,
      kind: g.kind,
      required: g.required ?? true,
      sortOrder: idx,
      perSheet: g.perSheet ?? false,
      perQuantity: g.perQuantity ?? false,
      perArea: g.perArea ?? false,
      allowDirectInput: g.allowDirectInput ?? false,
      minDirectInput: g.minDirectInput ?? null,
      maxDirectInput: g.maxDirectInput ?? null,
      isInnerPaper: g.isInnerPaper ?? false,
      isCoverPaper: g.isCoverPaper ?? false,
    })),
  });
}

export const TEMPLATE_LABELS: Record<ProductTemplate, string> = {
  NONE: "빈 상품 (옵션 직접 추가)",
  BOOKLET: "책자 (사이즈·페이지·표지·내지·제본 자동)",
  FLAT_PRINT: "낱장 인쇄 (사이즈·수량·용지·인쇄·후가공 자동)",
};
