import type { OptionGroupWithItems } from "./types";

interface Props {
  group: OptionGroupWithItems;
}

const cellCls = "px-1.5 text-[10px] font-medium uppercase tracking-wider text-text-tertiary";

/**
 * OptionItemRow 와 동일한 칼럼 구성으로 헤더 한 줄을 렌더한다.
 * 칼럼 너비/정렬은 row 와 정확히 일치해야 한다.
 */
export function OptionItemHeader({ group }: Props) {
  const isSheetQty = group.kind === "SHEET_COUNT" || group.kind === "QUANTITY";
  const showMultiplier = isSheetQty && !group.allowDirectInput;
  const showRange = isSheetQty && group.allowDirectInput;
  const showDims = group.kind === "DIMENSIONS";
  const showThickness =
    group.kind === "INNER_PAPER" || group.kind === "COVER_PAPER";
  const showImage = group.displayType === "SWATCH";
  const showFacets = group.displayType === "CASCADE";

  return (
    <li className="flex items-center gap-1 bg-surface-muted/40 px-2 py-1.5">
      {/* move chevrons spacer (w-5) */}
      <div className="w-5 shrink-0" />

      {showFacets && (
        <>
          <div className={`${cellCls} w-24 text-left`}>
            {group.facetALabel || "1차"}
          </div>
          <div className={`${cellCls} w-20 text-left`}>
            {group.facetBLabel || "2차"}
          </div>
        </>
      )}

      <div className={`${cellCls} min-w-0 flex-1 text-left`}>표시명</div>
      <div className={`${cellCls} w-24 text-left`}>value</div>
      {!showDims && (
        <div className={`${cellCls} w-32 text-right`}>추가금액</div>
      )}

      {showMultiplier && <div className={`${cellCls} w-16 text-right`}>장·부수</div>}
      {showRange && (
        <>
          <div className={`${cellCls} w-14 text-right`}>min</div>
          <span className="w-2" />
          <div className={`${cellCls} w-14 text-right`}>max</div>
        </>
      )}
      {showDims && (
        <>
          <div className={`${cellCls} w-14 text-right`}>가로</div>
          <span className="w-2" />
          <div className={`${cellCls} w-14 text-right`}>세로</div>
          <span className="w-2.5" />
        </>
      )}
      {showThickness && <div className={`${cellCls} w-16 text-right`}>두께</div>}

      <div className={`${cellCls} w-20 text-right`}>비활성 조건</div>
      <div className={`${cellCls} w-16 text-right`}>+영업일</div>

      {showImage && <div className={`${cellCls} w-32 text-left`}>이미지</div>}

      {/* delete button spacer (size-6) */}
      <div className="w-6 shrink-0" />
    </li>
  );
}
