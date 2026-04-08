-- OptionItem.showWhen (opt-in 노출) 을 disabledWhen (opt-out 비활성) 으로 이름 변경
-- 기존 값이 있다면 semantics 가 반대가 되므로 수동 재작성 필요 (MVP 단계 — 테스트 데이터 위주)
ALTER TABLE "OptionItem" RENAME COLUMN "showWhen" TO "disabledWhen";
