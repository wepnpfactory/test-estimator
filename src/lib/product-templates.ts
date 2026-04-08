// 상품 템플릿별 옵션 그룹 + 아이템 스캐폴드 정의
//
// 출처: docs/20260408-legacy-product-options.md (48종 분석)
// 가격은 모두 0 으로 시작 — 관리자가 카탈로그에 맞춰 채움.
// showWhen 같은 조건부 노출은 그룹 ID 가 필요하므로 스캐폴드 후 관리자가 직접 연결.

import { prisma } from "@/lib/prisma";
import type { ProductTemplate } from "@/generated/prisma/client";

interface ItemSeed {
  label: string;
  value: string;
  multiplier?: number;
  minRange?: number;
  maxRange?: number;
  widthMm?: number;
  heightMm?: number;
  thicknessMm?: number;
}

interface GroupSeed {
  name: string;
  value: string;
  kind:
    | "NORMAL"
    | "SHEET_COUNT"
    | "QUANTITY"
    | "DIMENSIONS"
    | "INNER_PAPER"
    | "COVER_PAPER";
  required?: boolean;
  perSheet?: boolean;
  perQuantity?: boolean;
  perArea?: boolean;
  allowDirectInput?: boolean;
  minDirectInput?: number;
  maxDirectInput?: number;
  items?: ItemSeed[];
}

// ───────────────────────────────────────────────
// 책자 — 003·004 양장 풀스펙 기준
// ───────────────────────────────────────────────
const BOOKLET_GROUPS: GroupSeed[] = [
  {
    name: "사이즈",
    value: "size",
    kind: "DIMENSIONS",
    required: true,
    items: [
      { label: "A4 (210×297)", value: "a4", widthMm: 210, heightMm: 297 },
      { label: "B5 (182×257)", value: "b5", widthMm: 182, heightMm: 257 },
      { label: "A5 (148×210)", value: "a5", widthMm: 148, heightMm: 210 },
      { label: "신국판 (152×225)", value: "singuk", widthMm: 152, heightMm: 225 },
      { label: "크라운판 (176×248)", value: "crown", widthMm: 176, heightMm: 248 },
      { label: "B6 (128×182)", value: "b6", widthMm: 128, heightMm: 182 },
      { label: "A6 (105×148)", value: "a6", widthMm: 105, heightMm: 148 },
    ],
  },
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
  {
    name: "인쇄기",
    value: "press",
    kind: "NORMAL",
    required: true,
    items: [
      { label: "윤전인쇄", value: "rollprint" },
      { label: "인디고인쇄", value: "indigo" },
      { label: "토너인쇄", value: "toner" },
      { label: "옵셋인쇄", value: "offset" },
    ],
  },
  {
    name: "제본 형태",
    value: "binding",
    kind: "NORMAL",
    required: true,
    items: [
      { label: "무선", value: "perfect" },
      { label: "무선날개", value: "perfect_bound" },
      { label: "트윈링", value: "twinring" },
      { label: "코일링(크리스탈링)", value: "coil" },
      { label: "중철", value: "saddle" },
      { label: "양장", value: "case_bound" },
    ],
  },
  {
    name: "커버 타입",
    value: "cover_type",
    kind: "NORMAL",
    required: true,
    items: [
      { label: "소프트 커버", value: "soft" },
      { label: "낱장 커버", value: "single_sheet" },
      { label: "하드 커버", value: "hard" },
    ],
  },
  {
    name: "양장 종류",
    value: "hardcover_type",
    kind: "NORMAL",
    required: false,
    items: [
      { label: "각양장", value: "square" },
      { label: "환양장", value: "round" },
    ],
  },
  {
    name: "제본 방향",
    value: "binding_direction",
    kind: "NORMAL",
    required: true,
    items: [
      { label: "세로형 좌철", value: "portrait_left" },
      { label: "세로형 상철", value: "portrait_top" },
      { label: "가로형 좌철", value: "landscape_left" },
      { label: "가로형 상철", value: "landscape_top" },
    ],
  },
  {
    name: "링 색상",
    value: "ring_color",
    kind: "NORMAL",
    required: false,
    items: [
      { label: "흰색", value: "white" },
      { label: "은색", value: "silver" },
      { label: "검정색", value: "black" },
      { label: "투명", value: "clear" },
    ],
  },
  {
    name: "가름끈",
    value: "tailband",
    kind: "NORMAL",
    required: false,
    items: [
      { label: "사용 안 함", value: "none" },
      { label: "백색", value: "white" },
      { label: "검정", value: "black" },
      { label: "적색", value: "red" },
      { label: "수박색", value: "watermelon" },
      { label: "곤색", value: "navy" },
      { label: "금색", value: "gold" },
    ],
  },
  {
    name: "표지 종이",
    value: "cover_paper",
    kind: "COVER_PAPER",
    required: true,
    perQuantity: true,
    perArea: true,
    items: [
      { label: "아트", value: "art" },
      { label: "스노우", value: "snow" },
      { label: "랑데뷰 화이트", value: "rendezvous_white" },
      { label: "랑데뷰 내추럴", value: "rendezvous_natural" },
      { label: "아르떼 화이트", value: "arte_white" },
      { label: "아르떼 내추럴", value: "arte_natural" },
      { label: "앙상블 E클래스 고백색", value: "ensemble_eclass_off" },
      { label: "앙상블 E클래스 백색", value: "ensemble_eclass_white" },
    ],
  },
  {
    name: "표지 평량",
    value: "cover_gsm",
    kind: "NORMAL",
    required: true,
    items: [
      { label: "180g", value: "g180" },
      { label: "200g", value: "g200" },
      { label: "250g", value: "g250" },
      { label: "300g", value: "g300" },
    ],
  },
  {
    name: "표지 인쇄면",
    value: "cover_side",
    kind: "NORMAL",
    required: true,
    items: [
      { label: "단면 인쇄", value: "one" },
      { label: "양면 인쇄", value: "both" },
    ],
  },
  {
    name: "표지 코팅",
    value: "cover_coating",
    kind: "NORMAL",
    required: false,
    items: [
      { label: "코팅 없음", value: "none" },
      { label: "무광 라미네이팅", value: "matte" },
      { label: "유광 라미네이팅", value: "gloss" },
      { label: "엠보 라미네이팅", value: "emboss" },
      { label: "흠집방지 무광", value: "scratch_proof_matte" },
    ],
  },
  {
    name: "후가공 - 박",
    value: "foil",
    kind: "NORMAL",
    required: false,
    perQuantity: true,
    items: [
      { label: "없음", value: "none" },
      { label: "금박", value: "gold" },
      { label: "은박", value: "silver" },
      { label: "홀로그램박", value: "holo" },
      { label: "청박", value: "blue" },
      { label: "적박", value: "red" },
      { label: "먹박", value: "black" },
    ],
  },
  {
    name: "후가공 - 에폭시",
    value: "epoxy",
    kind: "NORMAL",
    required: false,
    perQuantity: true,
    items: [
      { label: "사용 안 함", value: "off" },
      { label: "부분 에폭시", value: "partial" },
    ],
  },
  {
    name: "내지 종이",
    value: "inner_paper",
    kind: "INNER_PAPER",
    required: true,
    perSheet: true,
    perQuantity: true,
    perArea: true,
    items: [
      { label: "모조 미색", value: "mojo_off" },
      { label: "모조 백색", value: "mojo_white" },
      { label: "아트", value: "art" },
      { label: "스노우", value: "snow" },
      { label: "에스플러스 미색", value: "splus_off" },
      { label: "에스플러스 백색", value: "splus_white" },
      { label: "뉴플러스 백색", value: "newplus_white" },
      { label: "뉴플러스 미색", value: "newplus_off" },
      { label: "랑데뷰 화이트", value: "rendezvous_white" },
      { label: "랑데뷰 내추럴", value: "rendezvous_natural" },
      { label: "아르떼 화이트", value: "arte_white" },
      { label: "아르떼 내추럴", value: "arte_natural" },
    ],
  },
  {
    name: "내지 평량",
    value: "inner_gsm",
    kind: "NORMAL",
    required: true,
    items: [
      { label: "80g", value: "g80" },
      { label: "100g", value: "g100" },
      { label: "120g", value: "g120" },
    ],
  },
  {
    name: "내지 색도",
    value: "inner_color",
    kind: "NORMAL",
    required: true,
    items: [
      { label: "컬러 인쇄 (4도)", value: "color_4d" },
      { label: "흑백 인쇄 (1도)", value: "mono_1d" },
    ],
  },
  {
    name: "내지 인쇄면",
    value: "inner_side",
    kind: "NORMAL",
    required: true,
    items: [
      { label: "단면 인쇄", value: "one" },
      { label: "양면 인쇄", value: "both" },
    ],
  },
  {
    name: "면지 사용",
    value: "flyleaf",
    kind: "NORMAL",
    required: false,
    items: [
      { label: "사용 안 함", value: "none" },
      { label: "사용", value: "use" },
    ],
  },
  {
    name: "면지 종이",
    value: "flyleaf_paper",
    kind: "NORMAL",
    required: false,
    items: [
      { label: "밍크 계란", value: "mink_egg" },
      { label: "밍크 연노랑", value: "mink_yellow" },
      { label: "밍크 남색", value: "mink_navy" },
      { label: "모조 미색", value: "mojo_off" },
    ],
  },
  {
    name: "면지 매수",
    value: "flyleaf_count",
    kind: "NORMAL",
    required: false,
    items: [
      { label: "앞뒤 1장씩", value: "1" },
      { label: "앞뒤 2장씩", value: "2" },
    ],
  },
  {
    name: "긴급 제작",
    value: "urgent",
    kind: "NORMAL",
    required: false,
    items: [
      { label: "일반", value: "normal" },
      { label: "긴급 (+20%)", value: "urgent" },
    ],
  },
  {
    name: "배송 방식",
    value: "delivery",
    kind: "NORMAL",
    required: false,
    items: [
      { label: "택배", value: "parcel" },
      { label: "방문 수령", value: "pickup" },
      { label: "퀵배송", value: "quick" },
      { label: "직배송", value: "direct" },
    ],
  },
];

// ───────────────────────────────────────────────
// 낱장 인쇄 — 명함(041~048) + 포스터(031~037) 통합
// ───────────────────────────────────────────────
const FLAT_PRINT_GROUPS: GroupSeed[] = [
  {
    name: "사이즈",
    value: "size",
    kind: "DIMENSIONS",
    required: true,
    items: [
      // 명함
      { label: "명함 (90×50)", value: "biz_90x50", widthMm: 90, heightMm: 50 },
      { label: "명함 (90×52)", value: "biz_90x52", widthMm: 90, heightMm: 52 },
      { label: "명함 (85×55)", value: "biz_85x55", widthMm: 85, heightMm: 55 },
      { label: "명함 (86×52)", value: "biz_86x52", widthMm: 86, heightMm: 52 },
      // 엽서
      { label: "엽서 (100×148)", value: "post_100x148", widthMm: 100, heightMm: 148 },
      { label: "A6 (105×148)", value: "a6", widthMm: 105, heightMm: 148 },
      // 포스터
      { label: "B4 (257×364)", value: "b4", widthMm: 257, heightMm: 364 },
      { label: "A3 (297×420)", value: "a3", widthMm: 297, heightMm: 420 },
      { label: "B3 (364×515)", value: "b3", widthMm: 364, heightMm: 515 },
      { label: "A2 (420×594)", value: "a2", widthMm: 420, heightMm: 594 },
      { label: "B2 (515×728)", value: "b2", widthMm: 515, heightMm: 728 },
      { label: "국반절 (394×545)", value: "kuk_half", widthMm: 394, heightMm: 545 },
    ],
  },
  {
    name: "수량",
    value: "qty",
    kind: "QUANTITY",
    required: true,
    allowDirectInput: true,
    minDirectInput: 1,
    maxDirectInput: 100000,
  },
  {
    name: "인쇄기",
    value: "press",
    kind: "NORMAL",
    required: true,
    items: [
      { label: "인디고인쇄", value: "indigo" },
      { label: "토너인쇄", value: "toner" },
      { label: "옵셋인쇄", value: "offset" },
    ],
  },
  {
    name: "양면/단면",
    value: "side",
    kind: "NORMAL",
    required: true,
    perQuantity: true,
    items: [
      { label: "단면 인쇄", value: "one" },
      { label: "양면 인쇄", value: "both" },
    ],
  },
  {
    name: "색도",
    value: "ink",
    kind: "NORMAL",
    required: true,
    perQuantity: true,
    items: [
      { label: "컬러 (4도)", value: "color_4d" },
      { label: "흑백 (1도)", value: "mono_1d" },
    ],
  },
  {
    name: "용지",
    value: "paper",
    kind: "NORMAL",
    required: true,
    perQuantity: true,
    perArea: true,
    items: [
      // 명함
      { label: "랑데뷰 내추럴", value: "rendezvous_natural" },
      { label: "랑데뷰 화이트", value: "rendezvous_white" },
      { label: "아르떼 화이트", value: "arte_white" },
      { label: "아르떼 내추럴", value: "arte_natural" },
      { label: "앙상블 E클래스 고백색", value: "ensemble_eclass_off" },
      { label: "앙상블 E클래스 백색", value: "ensemble_eclass_white" },
      { label: "인스퍼 M러프 엑스트라 화이트", value: "inspire_m_rough" },
      { label: "스노우", value: "snow" },
      { label: "아트", value: "art" },
      // 포스터 추가
      { label: "모조 미색", value: "mojo_off" },
      { label: "모조 백색", value: "mojo_white" },
      { label: "뉴플러스 미색", value: "newplus_off" },
      { label: "뉴플러스 백색", value: "newplus_white" },
    ],
  },
  {
    name: "평량",
    value: "gsm",
    kind: "NORMAL",
    required: true,
    items: [
      { label: "100g", value: "g100" },
      { label: "120g", value: "g120" },
      { label: "150g", value: "g150" },
      { label: "180g", value: "g180" },
      { label: "200g", value: "g200" },
      { label: "230g", value: "g230" },
      { label: "240g", value: "g240" },
      { label: "250g", value: "g250" },
      { label: "300g", value: "g300" },
    ],
  },
  {
    name: "코팅",
    value: "coating",
    kind: "NORMAL",
    required: false,
    perQuantity: true,
    items: [
      { label: "없음", value: "none" },
      { label: "유광 라미네이팅", value: "gloss" },
      { label: "무광 라미네이팅", value: "matte" },
      { label: "엠보 라미네이팅", value: "emboss" },
      { label: "흠집방지 무광", value: "scratch_proof_matte" },
    ],
  },
  {
    name: "귀도리",
    value: "rounded_corner",
    kind: "NORMAL",
    required: false,
    perQuantity: true,
    items: [
      { label: "없음", value: "none" },
      { label: "4mm", value: "r4" },
    ],
  },
  {
    name: "후가공 - 박",
    value: "foil",
    kind: "NORMAL",
    required: false,
    perQuantity: true,
    items: [
      { label: "없음", value: "none" },
      { label: "금박", value: "gold" },
      { label: "은박", value: "silver" },
      { label: "홀로그램박", value: "holo" },
      { label: "청박", value: "blue" },
      { label: "적박", value: "red" },
      { label: "먹박", value: "black" },
    ],
  },
  {
    name: "후가공 - 에폭시",
    value: "epoxy",
    kind: "NORMAL",
    required: false,
    perQuantity: true,
    items: [
      { label: "사용 안 함", value: "off" },
      { label: "부분 에폭시", value: "partial" },
    ],
  },
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

  // 그룹 + 아이템 동시 생성. createMany 는 nested 안 되므로 순차 처리.
  for (let idx = 0; idx < groups.length; idx++) {
    const g = groups[idx];
    await prisma.optionGroup.create({
      data: {
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
        items: g.items
          ? {
              create: g.items.map((it, i) => ({
                label: it.label,
                value: it.value,
                addPrice: 0,
                multiplier: it.multiplier ?? 1,
                minRange: it.minRange ?? null,
                maxRange: it.maxRange ?? null,
                widthMm: it.widthMm ?? null,
                heightMm: it.heightMm ?? null,
                thicknessMm: it.thicknessMm ?? null,
                sortOrder: i,
              })),
            }
          : undefined,
      },
    });
  }
}

export const TEMPLATE_LABELS: Record<ProductTemplate, string> = {
  NONE: "빈 상품 (옵션 직접 추가)",
  BOOKLET: "책자 (사이즈·페이지·표지·내지·제본·후가공·면지·배송)",
  FLAT_PRINT: "낱장 인쇄 (사이즈·수량·용지·인쇄·코팅·후가공)",
};
