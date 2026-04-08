# 가변 옵션 견적 모델 — 진행 상황 & 주의사항

> 작성일: 2026-04-08
> 범위: 레거시 고도몰 21개 상품 (책자·포스터·명함) 의 옵션 구조를 Cafe24 동적 상품 + 가변 옵션 모델로 이관하기 위한 스키마·가격 로직·관리자 UI 업데이트.

---

## 1. 스키마 확장 (`prisma/schema.prisma`)

| 테이블                   | 필드                                                 | 용도                                                                       |
| ------------------------ | ---------------------------------------------------- | -------------------------------------------------------------------------- |
| `Product`                | `baseAreaMm2 Int`                                    | 면적 비례 가격(perArea)의 분모                                             |
| `Product`                | `bleedMm Int`                                        | 도련 — 표지 자동 사이즈 계산                                               |
| `Product`                | `leadTimeDays Int`                                   | 기본 제작 소요일                                                           |
| `Product`                | `template ProductTemplate`                           | `NONE / BOOKLET / FLAT_PRINT` 스캐폴드                                     |
| `OptionGroup`            | `kind OptionGroupKind`                               | `NORMAL / SHEET_COUNT / QUANTITY / DIMENSIONS / INNER_PAPER / COVER_PAPER` |
| `OptionGroup`            | `displayType OptionDisplayType`                      | `SELECT / RADIO / SWATCH / NUMBER / CHECKBOX / CASCADE`                    |
| `OptionGroup`            | `perSheet / perQuantity / perArea`                   | 곱셈 플래그                                                                |
| `OptionGroup`            | `allowDirectInput / minDirectInput / maxDirectInput` | 사용자가 숫자 직접 입력 (num_pages 2~800 같은 범위)                        |
| `OptionGroup`            | `maxWidthMm / maxHeightMm`                           | DIMENSIONS 상한 검증                                                       |
| `OptionGroup`            | `multiSelect Boolean`                                | 체크박스 다중 선택 (후가공 코팅+박+에폭시)                                 |
| `OptionGroup`            | `facetALabel / facetBLabel`                          | CASCADE 1차/2차 라벨 (예: "종이", "평량")                                  |
| `OptionGroup`            | `showWhen Json?`                                     | 조건부 노출 (AND)                                                          |
| `OptionItem`             | `addPrice Int`                                       | 가산 금액                                                                  |
| `OptionItem`             | `multiplier Int`                                     | SHEET_COUNT/QUANTITY 선택 값                                               |
| `OptionItem`             | `widthMm / heightMm`                                 | DIMENSIONS fit-best 매칭                                                   |
| `OptionItem`             | `minRange / maxRange`                                | 구간 매칭 (범위 직접 입력용)                                               |
| `OptionItem`             | `thicknessMm Float?`                                 | 책등·표지 사이즈 계산                                                      |
| `OptionItem`             | `leadTimeDays Int`                                   | 옵션별 추가 영업일                                                         |
| `OptionItem`             | `imageUrl String?`                                   | SWATCH 디스플레이용 이미지                                                 |
| `OptionItem`             | `facetA / facetB`                                    | CASCADE 2단 셀렉트 값                                                      |
| `OptionItem`             | `disabledWhen Json?`                                 | 아이템 단위 비활성 조건                                                    |
| `DynamicProduct`         | `shipments`, `leadTimeDays`, `estimatedShipAt`       | 분할 배송 + 출고 예정                                                      |
| `DynamicProductShipment` | 신규 모델                                            | 배송지별 수량/방식                                                         |
| enum `ShipmentMethod`    | `PARCEL / PICKUP / QUICK / DIRECT`                   |                                                                            |

### 마이그레이션 타임라인

```
20260408150000_shipment_checkbox_leadtime  — 체크박스·leadTime·Shipment
20260408160000_cascade_facets              — CASCADE enum + facetALabel/B/facetA/B
20260408170000_item_facets                 — facetA/B 멱등화 재적용
20260408150000_item_disabled_when          — item.disabledWhen
```

> 주의: 이전 `_item_facets` 가 한 번 실패해 `P3009` 가 발생했음 →
> `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 로 멱등화 후 `prisma migrate resolve --rolled-back` 으로 복구하고 재적용.

---

## 2. 가격 로직 (`src/lib/pricing/calculate.ts`)

### 평가 순서

1. **그룹 가시성 결정** — `showWhen` 을 fixed-point loop (최대 5회) 로 평가
2. **selection → resolved item** — DIMENSIONS / SHEET_COUNT+directInput / 일반 itemId 분기
3. **필수 그룹 검증**
4. **sheets / quantity / areaMm2 / trimW·H 집계**
5. **책등 + 표지 면적 자동 계산**
   - `innerThicknessMm = (INNER_PAPER 그룹 선택).thicknessMm`
   - `physicalSheets = ceil(sheets / 2)`
   - `spineMm = physicalSheets × innerThicknessMm`
   - `coverArea = (trimW × 2 + spine + bleed × 2) × (trimH + bleed × 2)`
   - `coverAreaRatio = coverArea / Product.baseAreaMm2`
6. **합계 + leadTime 집계**
   - `c = item.addPrice`
   - `if perSheet: c *= sheets`
   - `if perQuantity: c *= quantity`
   - `if perArea`: COVER_PAPER 는 `coverAreaRatio`, 그 외는 `areaRatio`
   - `optionsAddPrice += c`
   - `leadTimeDays = Product.leadTimeDays + max(선택 옵션.leadTimeDays)`

### `QuoteResult` 노출 필드

`basePrice / optionsAddPrice / finalPrice / sheets / quantity / areaMm2 / areaRatio / spineMm / coverAreaMm2 / coverAreaRatio / leadTimeDays / resolvedItems / visibleGroupIds / errors`

### 멀티 선택 처리

- `group.multiSelect === true` 인 경우 같은 그룹에 여러 selection 허용 (중복 탐지 스킵)
- 후가공 체크박스 (코팅·박·에폭시 동시 선택) 용도

### 가상 아이템

- SHEET_COUNT/QUANTITY allowDirectInput 에서 matching range 가 없을 때 `addPrice=0` 가상 아이템으로 fallback — 로직이 nil 로 깨지지 않게

---

## 3. Storefront API (`src/app/api/shop/[mallId]/products/[cafe24ProductNo]`)

### `GET /route.ts` 응답 필드

```
{
  id, mallId, name, basePrice, baseAreaMm2, bleedMm, leadTimeDays,
  optionGroups: [{
    id, name, value, displayType, required, kind, showWhen,
    maxWidthMm, maxHeightMm, perSheet, perQuantity, perArea,
    allowDirectInput, minDirectInput, maxDirectInput,
    multiSelect, facetALabel, facetBLabel,
    items: [{
      id, label, value, addPrice, multiplier,
      widthMm, heightMm, minRange, maxRange,
      thicknessMm, leadTimeDays, imageUrl,
      facetA, facetB, disabledWhen
    }]
  }]
}
```

### `POST /quote/route.ts`

`...quote` 전개로 `calculateQuote` 의 모든 필드 자동 포함 (`spineMm / coverAreaMm2 / coverAreaRatio / leadTimeDays` 포함).

### 임베드(embed.js) 할 일

- `displayType === 'CASCADE'` 면 `distinct(facetA)` 를 1차 셀렉트, 해당 facetA 의 `facetB` 를 2차 셀렉트로. 최종 선택 결과는 여전히 단일 `itemId`.
- `displayType === 'CHECKBOX' && multiSelect` 면 같은 그룹에 복수 selection 허용.
- `displayType === 'SWATCH'` 면 `imageUrl` + `label` 카드형 렌더.
- 출고 예정일 표시 = `leadTimeDays` 영업일 기준 계산 (공휴일 캘린더 미구현 — 현재는 단순 일수).

---

## 4. 관리자 UI

### 상품 페이지

- `ProductTypePanel` 이 템플릿(NONE/BOOKLET/FLAT_PRINT) 전환 + `baseAreaMm2 / bleedMm / leadTimeDays` 메타 편집 + `resetProductGroupsFromTemplate` (그룹 전부 삭제 후 템플릿 재시드)

### 옵션 그룹 설정 (`OptionGroupSettings`)

- `kind` 에 `INNER_PAPER / COVER_PAPER` 포함
- `displayType` 에 `CASCADE` 포함
- `CASCADE` 선택 시 `facetALabel / facetBLabel` 입력 필드 노출
- `CHECKBOX` 선택 시 `multiSelect` 체크박스 노출

### 옵션 아이템 스프레드시트 (`OptionItemRow + OptionItemHeader`)

- **구글시트 스타일**: 각 셀 클릭 → 인라인 input → Enter/blur 저장, Esc 취소
- 칼럼 구성 (그룹 설정에 따라 가변):
  ```
  ↕ | (facetA facetB)? | 표시명 | value | 추가금액 |
    | 장·부수 | min/max | 가로×세로 | 두께 |
    | 비활성 조건 | +영업일 | 이미지 | [삭제]
  ```
- 서버 액션 `updateOptionItem` 는 **patch 스타일** — `formData.has(key)` 인 필드만 업데이트, 나머지는 보존
- `leadTimeDays > 0` 일 때 가격 셀 옆에 브랜드색 `+N일` 뱃지

---

## 5. 상품 템플릿 (`src/lib/product-templates.ts`)

### `BOOKLET` — 양장 풀스펙 기준 (법위 003·004)

주요 그룹: 사이즈(DIMENSIONS) / 페이지수(SHEET_COUNT·directInput 2-800) / 수량(QUANTITY·directInput 1-10000) / 인쇄기 / 제본 형태 / 커버 타입 / 양장 종류 / 제본 방향 / 링 색상 / 가름끈 / **표지 용지(COVER_PAPER + CASCADE)** / 표지 인쇄면 / 표지 코팅 / 박 / 에폭시 / **내지 용지(INNER_PAPER + CASCADE)** / 내지 색도 / 내지 인쇄면 / 면지 3종 / 긴급 제작 / 배송 방식

### `FLAT_PRINT` — 명함(041~048) + 포스터(031~037) 통합

주요 그룹: 사이즈(DIMENSIONS) / 수량(QUANTITY·directInput) / 인쇄기 / 양/단면 / 색도 / **용지(CASCADE 13종 × 9평량)** / 코팅 / 귀도리 / 박 / 에폭시

### 데카르트 곱 헬퍼

```ts
paperFacetItems(papers, gsms); // facetA=종이, facetB=평량, thicknessMm 자동 주입
```

### 스캐폴드 저장 시 전달되는 필드

`name, value, kind, displayType, required, sortOrder, perSheet, perQuantity, perArea, allowDirectInput, minDirectInput, maxDirectInput, facetALabel, facetBLabel` + items: `label, value, addPrice=0, multiplier, minRange, maxRange, widthMm, heightMm, thicknessMm, facetA, facetB, sortOrder`.

---

## 6. 주의사항 / 누락 / TODO

### 구현 완료된 부분

- ✅ 스키마 + 마이그레이션 + Prisma 7 client 재생성
- ✅ `calculate.ts` multiSelect / leadTime / 책등·표지 자동 면적 / DIMENSIONS 상한 검증
- ✅ 관리자 스프레드시트형 편집 + 헤더 / patch-style 서버 액션
- ✅ Storefront API 응답에 신규 필드 노출
- ✅ 상품 템플릿 스캐폴드가 CASCADE/facet 필드까지 저장

### 아직 누락

- ⚠️ **임베드(embed.js) 프런트 렌더러** — 현재 스키마 변화를 반영하지 않음. 해야 할 것:
  - CASCADE 2단 셀렉트 렌더 (distinct facetA → facetB 필터)
  - CHECKBOX multiSelect 처리 + quote 요청 시 selection 배열에 같은 groupId 여러 번 push
  - SWATCH imageUrl 렌더
  - 책등/표지 면적을 견적 패널에 노출 (현재 `quote.spineMm / coverAreaMm2` 는 내려가지만 UI 표시 안 함)
  - `leadTimeDays` 로 "N 영업일 후 출고" 문구

- ⚠️ **Checkout API 분할 배송 검증** — `DynamicProductShipment` 모델만 있고, `quantity 합 === QUANTITY 그룹 입력값` 검증 로직이 체크아웃 API 에 추가되지 않음.

- ⚠️ **영업일 / 공휴일 캘린더** — `leadTimeDays` 는 단순 일수. "오늘 + N 영업일" 로 날짜를 산출하려면 공휴일 테이블/라이브러리 필요 (`DynamicProduct.estimatedShipAt` 계산 시점).

- ⚠️ **PriceRule 평가** — 스키마엔 있지만 `calculate.ts` 가 사용하지 않음. 현재는 CASCADE 단일 그룹으로 종이×평량 가격 조합을 해결했지만, 더 복잡한 조건부 할증(예: "A4 + 100부 이상 → 10% 할인") 이 필요할 때 구현해야 함.

- ⚠️ **면지 사용량 → 내지 sheets 와의 연동** — 현재 면지 그룹 선택은 sheets 에 반영되지 않음. 면지 매수가 사이즈/두께 계산에 영향 주는 경우 별도 처리 필요.

- ⚠️ **`thicknessMm` 시드 기본값 미입력** — `paperFacetItems` 가 gsms 배열에서 `thicknessMm` 를 가져오지만 BOOKLET_INNER_GSMS / BOOKLET_COVER_GSMS 에 값이 없음. 관리자가 상품별로 직접 입력해야 책등 계산이 동작.

- ⚠️ **CASCADE 아이템 자동 생성 UX** — 현재 데카르트 곱은 스캐폴드 시점에만. 운영 중 종이 한 종류를 추가하려면 관리자가 모든 평량 조합을 수동으로 추가해야 함. 향후 "종이 추가 → 자동으로 기존 평량 × 곱 생성" 버튼 필요.

- ⚠️ **`isInnerPaper / isCoverPaper` (deprecated) 정리** — schema 에서 제거되긴 했는데 일부 관리자 코드가 아직 참조하지 않는지 재확인 필요 (tsc 는 통과 중이므로 참조 없음 추정).

- ⚠️ **인쇄방식 비교 테이블 (컨셉 스크린샷 하단)** — "토너/인디고/윤전/옵셋" 4열 견적 비교. 구현 전략: quote API 를 동일 selection 으로 `print_type` 만 교체해 N회 호출 → UI 에서 집계. 백엔드 변경 불필요.

- ⚠️ **출고 예정일 캘린더 아이콘/배지** — 컨셉 스크린샷의 "4월 3일 출고 예정" 같은 표시는 클라이언트 단 계산으로. 오늘 + `leadTimeDays` 영업일 로직.

### Prisma / Next 관련 주의

- **Prisma 7** + `schema.prisma` 내 `@@unique` 가 모델 본문에 위치해야 함 (경고 주석 존재).
- Next.js 이번 버전은 `middleware` → **`proxy.ts`** 로 변경된 점, 이 프로젝트는 App Router 사용, `api/**` 는 route handler 로 동작.
- 서버 액션은 `formData.has()` 로 partial patch 처리 → 클라이언트가 보내지 않은 필드는 DB 에 그대로 보존 (실수로 null 덮어쓰지 않음).

### 관리자 UI 주의

- **Cell 컴포넌트** 는 React hooks + `useTransition` 으로 낙관 업데이트 없이 단순 revalidate. 대량 수정 시 서버 왕복이 많음 → 필요하면 debounce 추가.
- **fixed-point loop** 가 조건 체인이 5 단계 이상이면 조기 종료. 조건 체인이 깊어지면 깊이를 늘리거나 DAG 평가로 교체 필요.

---

## 7. 파일 위치 치트시트

```
prisma/schema.prisma
prisma/migrations/20260408150000_*, _160000_, _170000_
src/lib/pricing/calculate.ts
src/lib/product-templates.ts
src/app/admin/products/[id]/page.tsx
src/app/admin/products/[id]/_components/
  base-area-form.tsx
  product-type-panel.tsx (ProductTypePanel)
  option-group/
    option-group-card.tsx
    option-group-settings.tsx
    option-item-row.tsx        ← 스프레드시트 셀
    option-item-header.tsx     ← 테이블 헤더
    condition-picker.tsx       ← showWhen / disabledWhen
    field.tsx, types.ts, index.ts
src/app/api/shop/[mallId]/products/[cafe24ProductNo]/
  route.ts           (GET 상품 스키마)
  quote/route.ts     (POST 견적)
  checkout/route.ts  (체크아웃 — shipments 검증 TODO)
```
