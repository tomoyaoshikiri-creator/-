begin;

-- 予定の種別に「その他」を追加する。既存のtype列はpractice/game/eventいずれも英語リテラルのため、
-- 新しい値も同じ命名規則に合わせてotherとする(表示ラベルは「その他」、値はother)。
alter table public.schedules drop constraint schedules_type_check;
alter table public.schedules
  add constraint schedules_type_check check (type in ('practice', 'game', 'event', 'other'));

commit;
