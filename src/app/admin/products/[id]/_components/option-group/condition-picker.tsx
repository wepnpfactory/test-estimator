"use client";

import { Plus, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { buttonCls, buttonGhostCls, inputCls, labelCaptionCls } from "../form-styles";
import type { OptionGroupWithItems } from "./types";

export interface Condition {
  groupId: string;
  itemId: string;
}

interface Props {
  /** "표시 조건" | "비활성 조건" 등 라벨 */
  title: string;
  /** 현재 선택된 조건 배열 */
  value: Condition[];
  /**
   * 후보로 노출할 선행 옵션 그룹 목록.
   * 호출부에서 sortOrder 기준으로 "현재 그룹보다 앞에 있는" 그룹만 골라서 넘긴다.
   * (조건은 항상 선행 옵션을 참조해야 의미가 있으므로)
   */
  precedingGroups: OptionGroupWithItems[];
  /** 변경 시 호출되는 콜백. 안에서 server action 을 호출해 저장하면 됨 */
  onChange: (next: Condition[]) => void;
  /** pending 인디케이터 */
  pending?: boolean;
}

/**
 * 옵션의 표시/비활성 조건을 선택하는 작은 모달.
 * - 트리거 버튼은 현재 선택 개수만 보여준다 ("조건 2개" / "조건 없음")
 * - 모달 안에서 선행 그룹 → 아이템 순으로 골라 추가
 * - 추가/삭제 즉시 onChange 호출 (auto-save)
 */
export function ConditionPicker({ title, value, precedingGroups, onChange, pending = false }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draftGroupId, setDraftGroupId] = useState<string>("");
  const [draftItemId, setDraftItemId] = useState<string>("");
  // draftGroupId 가 바뀌면 draftItemId 를 렌더 중 리셋한다 (effect 대신 derived 패턴)
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [prevGroupId, setPrevGroupId] = useState<string>(draftGroupId);
  if (prevGroupId !== draftGroupId) {
    setPrevGroupId(draftGroupId);
    setDraftItemId("");
  }

  const draftGroup = precedingGroups.find((g) => g.id === draftGroupId);

  function open() {
    dialogRef.current?.showModal();
  }
  function close() {
    dialogRef.current?.close();
  }

  function add() {
    if (!draftGroupId || !draftItemId) return;
    // 중복 방지
    const exists = value.some((c) => c.groupId === draftGroupId && c.itemId === draftItemId);
    if (exists) return;
    onChange([...value, { groupId: draftGroupId, itemId: draftItemId }]);
    setDraftItemId("");
  }

  function remove(idx: number) {
    const next = value.slice();
    next.splice(idx, 1);
    onChange(next);
  }

  // 표시용 라벨 룩업 — precedingGroups 에 없는(=뒤로 이동해 더 이상 선행이 아닌)
  // 그룹은 "(순서 변경됨)" 으로 안내한다.
  function labelOf(c: Condition): string {
    const g = precedingGroups.find((x) => x.id === c.groupId);
    if (!g) return "(순서 변경됨)";
    const it = g.items.find((x) => x.id === c.itemId);
    return `${g.name} = ${it?.label ?? "(삭제됨)"}`;
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={pending}
        className="inline-flex h-7 items-center gap-1 rounded border border-border bg-card px-2 text-[11px] font-medium text-text-secondary hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {value.length === 0 ? (
          <span className="text-text-disabled">조건 없음</span>
        ) : (
          <span className="text-foreground">조건 {value.length}개</span>
        )}
        <Plus className="size-3" aria-hidden />
      </button>

      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto rounded-xl border border-border bg-card p-0 text-foreground shadow-(--shadow-modal) backdrop:bg-black/30"
      >
        <div className="flex w-105 max-w-[90vw] flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <button
              type="button"
              onClick={close}
              aria-label="닫기"
              className="flex size-6 items-center justify-center rounded text-text-tertiary hover:bg-surface-subtle hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          {/* 현재 조건 목록 */}
          <div className="space-y-1.5">
            <span className={labelCaptionCls}>현재 조건</span>
            {value.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-[11px] text-text-tertiary">
                선택된 조건이 없습니다
              </p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
                {value.map((c, i) => (
                  <li
                    key={`${c.groupId}:${c.itemId}:${i}`}
                    className="flex items-center justify-between gap-2 bg-surface-subtle px-3 py-2 text-xs"
                  >
                    <span className="min-w-0 truncate text-foreground">{labelOf(c)}</span>
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      aria-label="제거"
                      className="flex size-5 shrink-0 items-center justify-center rounded text-text-tertiary hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 새 조건 추가 */}
          <div className="space-y-1.5">
            <span className={labelCaptionCls}>조건 추가</span>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <select value={draftGroupId} onChange={(e) => setDraftGroupId(e.target.value)} className={inputCls}>
                <option value="">선행 옵션…</option>
                {precedingGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <select
                value={draftItemId}
                onChange={(e) => setDraftItemId(e.target.value)}
                disabled={!draftGroup}
                className={inputCls + " disabled:opacity-50"}
              >
                <option value="">옵션 값…</option>
                {draftGroup?.items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={add}
                disabled={!draftGroupId || !draftItemId || pending}
                className={buttonGhostCls}
              >
                추가
              </button>
            </div>
            {precedingGroups.length === 0 && (
              <p className="text-[11px] text-text-tertiary">
                선행 옵션 그룹이 없습니다. 그룹 순서를 위로 옮기거나 다른 그룹을 먼저 만드세요.
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <button type="button" onClick={close} className={buttonCls}>
              닫기
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

/**
 * Prisma JSON 필드를 안전하게 Condition[] 로 파싱.
 */
export function parseConditions(raw: unknown): Condition[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (x): x is Condition =>
        !!x &&
        typeof x === "object" &&
        typeof (x as Condition).groupId === "string" &&
        typeof (x as Condition).itemId === "string"
    )
    .map((x) => ({ groupId: x.groupId, itemId: x.itemId }));
}

/**
 * Picker + 서버 액션을 묶어 주는 헬퍼.
 * patch(name, value) 형태의 콜백을 받아 자동 저장한다.
 */
export function useConditionPatch(name: string, patch: (name: string, value: string) => void) {
  const [pending, startTransition] = useTransition();
  const apply = (next: Condition[]) => {
    startTransition(() => {
      patch(name, JSON.stringify(next));
    });
  };
  return { apply, pending };
}
