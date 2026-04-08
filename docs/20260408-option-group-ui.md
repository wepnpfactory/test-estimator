# 옵션 그룹 편집 UI — 설계 노트

작성: 2026-04-08
대상: `src/app/admin/products/[id]/` 옵션 상품 편집 화면

---

## 1. 디렉터리 구조

```
src/app/admin/products/[id]/
├── page.tsx                          # 서버 컴포넌트, 모든 server actions 정의
└── _components/
    ├── form-styles.ts                # 공용 클래스 토큰 (inputCls/buttonCls/...)
    ├── collapsible-section.tsx       # localStorage 유지 접기/펼치기
    ├── template-picker.tsx           # 상품 종류 선택 (segmented control)
    ├── base-area-form.tsx            # 기준 사이즈 / 도련 / leadTime 입력
    ├── option-bulk-paste.tsx         # 옵션 아이템 일괄 붙여넣기
    └── option-group/                 # 옵션 그룹 관련 UI 일체
        ├── index.ts                  # public exports
        ├── types.ts                  # OptionGroupActions, OptionGroupWithItems
        ├── field.tsx                 # Field, KindBadge
        ├── option-group-card.tsx     # 그룹 카드 (헤더 + body 컨테이너) + AddOptionGroupForm
        ├── option-group-settings.tsx # 고급 설정 details (kind/displayType/곱셈/...)
        ├── option-item-header.tsx    # 아이템 목록 컬럼 헤더
        ├── option-item-row.tsx       # 단일 아이템 행 (inline cell editor)
        ├── condition-picker.tsx      # 표시/비활성 조건 선택 모달 (재사용)
        └── group-show-when-picker.tsx# 그룹 showWhen 폼 안 hidden input + 모달
```

**원칙**

- 옵션 그룹과 관련된 UI 변경은 모두 `_components/option-group/` 안에서만 일어난다. `page.tsx`는 server actions 정의 + `<OptionGroupCard>` 매핑만 담당.
- 새로운 옵션 그룹 필드를 schema에 추가하면 ① `updateOptionGroup` server action ② `option-group-settings.tsx` ③ 필요하면 `option-item-row.tsx` / `option-item-header.tsx` 세 곳만 손대면 됨.

---

## 2. 디자인 토큰 — `form-styles.ts`

모든 폼 요소는 `form-styles.ts` 의 4가지 클래스를 사용한다. **inline class 작성 금지** — 폼 요소가 일관성 잃는 가장 큰 원인이었기 때문.

| 토큰              | 용도                               | 정의                                                             |
| ----------------- | ---------------------------------- | ---------------------------------------------------------------- |
| `inputCls`        | 모든 input/select/textarea         | `h-8 / text-xs / border-border / bg-card / focus-visible ring`   |
| `buttonCls`       | primary 버튼 (저장, 추가)          | `h-8 / text-xs / bg-primary / focus-visible ring`                |
| `buttonGhostCls`  | 보조 버튼 (작은 추가, 인라인 저장) | `h-8 / text-xs / border-border / bg-card`                        |
| `labelCaptionCls` | 모든 라벨/캡션                     | `text-[11px] / uppercase / tracking-wider / text-text-secondary` |

**높이 통일**: 모든 인터랙티브 요소는 **h-8 (32px)**. segmented control(`template-picker`) 도 동일.

**색상**: zinc/rose/emerald 등 raw Tailwind 팔레트 **사용 금지**. 반드시 `theme.css` 시맨틱 토큰만 사용.

| 의미             | 토큰                                                                |
| ---------------- | ------------------------------------------------------------------- |
| 본문 텍스트      | `text-foreground`                                                   |
| 보조 텍스트      | `text-text-secondary` / `text-text-tertiary` / `text-text-disabled` |
| 카드 배경        | `bg-card`                                                           |
| 페이지/섹션 배경 | `bg-surface-page` / `bg-surface-subtle` / `bg-surface-muted`        |
| 보더             | `border-border`                                                     |
| 강조             | `bg-primary` / `text-primary-foreground`                            |
| 성공             | `bg-success` / `text-success`                                       |
| 위험/삭제        | `bg-destructive/10` / `text-destructive`                            |
| 경고             | `text-warning`                                                      |
| 정보             | `text-info`                                                         |

---

## 3. 폰트 사이즈 — 4단계 스케일

| 토큰          | px  | 용도                    |
| ------------- | --- | ----------------------- |
| `text-[11px]` | 11  | 라벨/캡션/뱃지/메타     |
| `text-xs`     | 12  | 본문, 인풋, 버튼, 셀 값 |
| `text-sm`     | 14  | 그룹 타이틀, 보조 헤더  |
| `text-base`   | 16  | 섹션 헤더               |

10px·13px·15px 등 중간값 금지. 캐노니컬 매칭이 없어 `text-[10px]` 만 예외적으로 한정 사용 (아이템 헤더 컬럼 라벨).

---

## 4. 옵션 그룹 카드 레이아웃

```
┌─ OptionGroupCard ───────────────────────────────────┐
│ ▲▼  [name] [kind뱃지] [필수] [N개]      [가격범위] ✕│  ← summary (CollapsibleSection 토글)
├─────────────────────────────────────────────────────┤
│ ▶ 고급 설정 (역할·필수·노출 조건)                    │  ← OptionGroupSettings (details, 기본 접힘)
│ ┌─ 옵션 아이템 목록 ─────────────────────────────┐ │
│ │ ▲▼  표시명  value  추가금액  [컨텍스트] [조건] ✕│ │  ← OptionItemHeader + OptionItemRow*
│ └─────────────────────────────────────────────────┘ │
│ [표시명][value][추가금액] [추가]                     │  ← 새 아이템 추가 폼
│ + 벌크 붙여넣기                                      │  ← OptionBulkPaste
└─────────────────────────────────────────────────────┘
```

- **카드 컨테이너**: `rounded-xl border border-border bg-card shadow-(--shadow-card)`
- **내부 본문**: `space-y-3 border-t border-border pt-3`
- **순서 변경 화살표**: `flex flex-col gap-1.5`, 각 버튼 `h-3.5 w-5` (그룹) / `size-5` (아이템)
- **삭제 (X)**: `size-7` (그룹) / `size-5~6` (아이템), hover `bg-destructive/10 text-destructive`
- **접힘 상태**: `CollapsibleSection`이 `localStorage["optgrp:{productId}:{groupId}"]`에 0/1 저장

---

## 5. 옵션 아이템 행 — Inline Cell Editor

옵션 아이템은 한 줄에 모든 필드를 컬럼으로 나열하고, 각 셀이 클릭/포커스 시 input으로 변환되는 **inline cell editing** 패턴을 쓴다.

### 컬럼 너비 (고정값)

| 컬럼                 | 너비             | 비고                           |
| -------------------- | ---------------- | ------------------------------ |
| 순서 변경 화살표     | `w-5 shrink-0`   | 헤더에는 동일 spacer           |
| 표시명               | `min-w-0 flex-1` | 가변, 가장 넓음                |
| value                | `w-24`           | mono font, 96px                |
| 추가금액             | `w-32`           | "0원 ×장 ×부 ×면적" 한 줄 보장 |
| multiplier (장·부수) | `w-16`           | SHEET_COUNT/QUANTITY 그룹만    |
| min~max (직접 입력)  | `w-14` × 2       | allowDirectInput true 일 때    |
| 가로/세로 (mm)       | `w-14` × 2       | DIMENSIONS 그룹                |
| 두께 (mm)            | `w-16`           | INNER_PAPER/COVER_PAPER 그룹   |
| facetA / facetB      | `w-24` / `w-20`  | CASCADE displayType            |
| 비활성 조건          | `w-20`           | 모든 그룹 (조건 모달)          |
| +영업일              | `w-16`           | 모든 그룹                      |
| imageUrl             | `w-32`           | SWATCH displayType             |
| 삭제                 | `w-6 shrink-0`   |

**중요**: row 와 header 의 컬럼 구성/너비는 **반드시 일치**. 헤더에 컬럼을 추가/제거하면 row에도 동일하게.

### Cell 컴포넌트 (`option-item-row.tsx`)

```tsx
<Cell
  name="multiplier" // FormData key
  defaultValue={item.multiplier}
  type="number" // "text" | "number" | "url"
  align="right" // "left" | "right" | "center"
  display={<span>×{item.multiplier}</span>}
  patch={patch} // (name, value) => Promise<void>
/>
```

- 평소엔 `display` 만 보여주는 `<button>`
- 클릭 시 `<input>`으로 전환, autoFocus
- Enter/blur 시 `commit()` → `patch(name, value)` 호출
- Escape 시 원복 후 종료
- `patch`는 단일 필드만 담은 FormData를 만들어 `actions.updateItem` 호출 (PATCH 스타일)

### `updateOptionItem` 의 PATCH 패턴

`page.tsx`의 `updateOptionItem` 은 FormData에 **존재하는 key 만** 업데이트한다. 다른 필드는 그대로 유지. 이 덕분에 inline cell editor가 한 필드씩 안전하게 저장 가능.

```ts
const setOptInt = (key, opts) => {
  if (!formData.has(key)) return; // 키가 없으면 패치하지 않음
  // ...
};
```

새 필드 추가 시 이 패턴(`formData.has` 체크)을 반드시 따라야 한다.

---

## 6. 조건 선택 모달 — `ConditionPicker`

`showWhen` (그룹 표시 조건) 과 `disabledWhen` (아이템 비활성 조건) 둘 다 동일한 `<ConditionPicker>` 모달을 사용한다.

### 사용 패턴

```tsx
<ConditionPicker
  title="비활성 조건"
  value={parseConditions(item.disabledWhen)}
  precedingGroups={precedingGroups} // 자신보다 sortOrder 가 앞선 그룹만
  onChange={(next) => apply(next)} // 자동 저장
  pending={pending}
/>
```

### 핵심 규칙

1. **선행 옵션만 후보로 노출**. 호출부에서 `precedingGroups = allGroups.filter(g => g.sortOrder < currentGroup.sortOrder)` 로 필터. 자기 자신 또는 뒤에 오는 그룹을 조건으로 쓰면 의미가 없음.
2. **순서 변경 후의 fallback**: 그룹 순서를 바꿔서 더 이상 선행이 아닌 조건이 남아있으면 라벨에 `(순서 변경됨)` 표시.
3. **자동 저장 vs 폼 저장**:
   - 아이템(`disabledWhen`): inline patch 흐름 → 추가/삭제 즉시 저장
   - 그룹(`showWhen`): 그룹 설정 폼 안의 hidden input 갱신 → 사용자가 "설정 저장" 눌러야 반영. 이렇게 해야 다른 그룹 필드를 덮어쓰지 않음.
4. **HTML `<dialog>` + Tailwind preflight**: `m-auto`가 reset 되므로 `fixed inset-0 m-auto` 명시 필요. 본문 컨테이너 `w-105` (= 420px) `max-w-[90vw]`.

---

## 7. 서버 액션 — 보안 패턴

모든 group/item mutation 액션은 **소유권 검증**을 거친다.

```ts
async function deleteOptionGroup(productId: string, groupId: string) {
  "use server";
  // deleteMany + relation filter — 소유권 검증과 삭제를 단일 쿼리로
  await prisma.optionGroup.deleteMany({
    where: { id: groupId, productId },
  });
  revalidatePath(`/admin/products/${productId}`);
}
```

- `update*` / `move*` 는 `assertGroupOwned(productId, groupId)` / `assertItemOwned(productId, itemId)` 헬퍼 호출 후 진행
- `add*` / `bulkAdd*` 는 `groupId` 가 해당 productId 소속인지 먼저 확인
- 직접 `prisma.*.delete({ where: { id } })` 사용 금지 — 다른 상품의 데이터를 삭제할 수 있음

### Json 필드

`showWhen` / `disabledWhen` 같은 Prisma `Json` 필드는 **`Prisma.InputJsonValue | typeof Prisma.JsonNull`** 유니온으로 다룬다. `as never` 캐스팅 금지.

```ts
let showWhen: Prisma.InputJsonValue | typeof Prisma.JsonNull = Prisma.JsonNull;
if (validArray) showWhen = parsed as Prisma.InputJsonValue;
```

### imageUrl XSS 방지

옵션 아이템의 `imageUrl`은 `^https?://` 만 허용. `javascript:` / `data:` / `file:` 등은 무시.

---

## 8. OptionGroupActions 인터페이스

`page.tsx` 에서 정의한 server actions 를 하나의 객체로 묶어 컴포넌트 트리로 전달한다.

```ts
interface OptionGroupActions {
  updateGroup;
  deleteGroup;
  moveGroup;
  addItem;
  updateItem;
  deleteItem;
  moveItem;
  bulkAddItems;
}
```

새 액션이 필요하면 `types.ts` 의 인터페이스에 추가하고 page.tsx 에서 정의 후 `optionGroupActions` 객체에 묶어 한 곳에서만 등록.

---

## 9. 회귀 방지 체크리스트

옵션 그룹 UI 수정 시 다음 항목을 PR 전 자가 점검:

- [ ] zinc/rose/emerald 등 raw 팔레트 사용 0건
- [ ] 모든 인풋/버튼이 `inputCls` / `buttonCls` / `buttonGhostCls` 를 사용
- [ ] 새 컬럼 추가 시 `option-item-row.tsx` 와 `option-item-header.tsx` 동시 수정
- [ ] 새 server action 은 `assertGroupOwned` / `assertItemOwned` 호출
- [ ] FormData 키가 없을 때 silent skip (PATCH 패턴 유지)
- [ ] Json 필드는 `Prisma.InputJsonValue | Prisma.JsonNull` 사용
- [ ] 새 옵션 그룹 필드는 `OptionGroupActions` 와 `OptionGroupWithItems` 에 자동 반영되는지 (Prisma 타입 export 확인)
- [ ] 조건 선택은 `ConditionPicker` 재사용, 직접 JSON textarea 만들지 말 것
- [ ] `pnpm exec next build` 통과
