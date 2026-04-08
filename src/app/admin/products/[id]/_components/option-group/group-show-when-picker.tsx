"use client";

import { useState } from "react";
import { ConditionPicker, parseConditions, type Condition } from "./condition-picker";
import type { OptionGroupWithItems } from "./types";

interface Props {
  /** prisma JSON 그대로 — 초기값 */
  currentShowWhen: unknown;
  precedingGroups: OptionGroupWithItems[];
}

/**
 * 그룹 "고급 설정" 폼 안에서 사용하는 showWhen 입력기.
 *
 * - 외부 form 의 hidden input(name="showWhen") 와 함께 들어간다.
 *   사용자가 모달에서 조건을 추가/제거할 때마다 hidden input 의 value 만
 *   업데이트하고, 실제 저장은 부모 form 의 "설정 저장" 버튼이 담당한다.
 * - 이렇게 하면 group 의 다른 필드(kind/required/...)를 덮어쓸 위험이 없다.
 */
export function GroupShowWhenPicker({ currentShowWhen, precedingGroups }: Props) {
  const [conditions, setConditions] = useState<Condition[]>(() => parseConditions(currentShowWhen));
  const serialized = conditions.length > 0 ? JSON.stringify(conditions) : "";

  return (
    <div className="flex items-center gap-2">
      <input type="hidden" name="showWhen" value={serialized} />
      <ConditionPicker
        title="보이는 조건"
        value={conditions}
        precedingGroups={precedingGroups}
        onChange={setConditions}
      />
      <span className="text-[11px] text-text-tertiary">저장 버튼을 눌러야 반영됩니다</span>
    </div>
  );
}
