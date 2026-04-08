-- 기존 isInnerPaper / isCoverPaper 데이터를 kind 로 승격
UPDATE "OptionGroup"
  SET "kind" = 'INNER_PAPER'
  WHERE "isInnerPaper" = true AND "kind" = 'NORMAL';

UPDATE "OptionGroup"
  SET "kind" = 'COVER_PAPER'
  WHERE "isCoverPaper" = true AND "kind" = 'NORMAL';
