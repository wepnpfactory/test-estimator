<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:styleseed-toss -->

# Design System — StyleSeed / Toss

이 프로젝트의 UI는 **StyleSeed / Toss** 디자인 시스템을 따른다. UI/스타일 작업 전 반드시 다음 문서를 먼저 읽고 규칙을 준수한다.

- 디자인 랭귀지 (색/숫자/트렌드/위계): `src/styles/DESIGN-LANGUAGE.md` — UI/스타일 작업 시작 전 Read 도구로 직접 읽을 것 (자동 import 안 함, 토큰 절약 목적)
- 토큰 원본 (브랜드/서피스/타이포/쉐도우): `src/styles/theme.css` — 필요 시 Read
- 프리미티브: `src/components/ui/*` (shadcn 스타일)
- 패턴: `src/components/patterns/*` (StatCard, HeroCard, SectionCard, ListItem, TopBar, PageShell 등)
- 전역 진입: `src/app/globals.css` (→ fonts → tailwind → tw-animate-css → theme → base)

## 핵심 규칙

- **단일 key color**(`--brand` = #721FE5)만 액티브/선택 상태에 사용. 본문/배경 대면적 사용 금지.
- **큰 숫자 + 작은 단위(2:1 비율)** — Hero 48/24, KPI 36/18, List 17/11. 단위는 `ms-0.5`.
- 텍스트 5단 위계: `text-text-primary` / `-secondary` / `-tertiary` / `-disabled`, icon은 `text-icon-default`.
- 라벨은 `text-[12px] font-medium uppercase tracking-[0.05em]`.
- 트렌드: up = `text-success`, down = `text-destructive`, 아이콘은 `TrendingUp/Down size-3.5~4 strokeWidth={2.5}`.
- 상태 dot은 6px, impact 컬러(#C85A54 등)는 dot+caption 조합에만 사용.
- 신규 컴포넌트: `data-slot="..."` 필수, `cn()`로 className 병합, CVA로 variant 관리, `React.ComponentProps<>` 타이핑.

## 금지

- 토큰이 있는 값에 inline hex 사용 금지.
- `w-4 h-4` → `size-4` (Tailwind v4 shorthand).
- `ml-*` → `ms-*` (logical prop).
- `p-[24px]` 같은 픽셀 하드코딩 금지 (`p-6` 사용).
- className만 덧붙이는 래퍼 컴포넌트 생성 금지 (호출부에서 `cn()`).

## 슬래시 커맨드

`.claude/skills/`에 UI 전용 스킬이 설치되어 있음:

- `/ui-component` 신규 컴포넌트 스캐폴드
- `/ui-page` 페이지 스캐폴드
- `/ui-pattern` 패턴 합성
- `/ui-review` 디자인 시스템 준수 리뷰
- `/ui-tokens` 토큰 조회/추가/변경
- `/ui-a11y` 접근성 감사
- `/ux-audit`, `/ux-copy`, `/ux-feedback`, `/ux-flow` UX 계열
<!-- END:styleseed-toss -->
