// 옵션 상품 편집 화면의 폼 요소 공통 스타일.
// 모든 색은 theme.css 의 시맨틱 토큰을 사용한다 (zinc/emerald/rose 직접 사용 금지).

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";

export const inputCls =
  `block h-8 min-w-0 rounded-md border border-border bg-card px-2 text-xs text-foreground placeholder:text-text-tertiary ${focusRing}`;

export const buttonCls =
  `inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50 ${focusRing}`;

export const buttonGhostCls =
  `inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-surface-subtle disabled:opacity-50 ${focusRing}`;

export const labelCaptionCls =
  "text-[11px] font-medium uppercase tracking-wide text-text-secondary";
