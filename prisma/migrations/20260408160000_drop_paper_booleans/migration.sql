-- kind enum 으로 일원화 완료 — 더 이상 사용하지 않는 boolean flag 제거
ALTER TABLE "OptionGroup"
  DROP COLUMN "isInnerPaper",
  DROP COLUMN "isCoverPaper";
