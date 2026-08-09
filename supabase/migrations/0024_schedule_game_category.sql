-- 予定(試合)に「練習試合」か「公式戦」かの区分を追加する。
-- 試合記録・試合結果一覧もこの区分で絞り込めるようにする(予定の属性として一元管理し、
-- 試合ごとに二重に持たせない)。
alter table public.schedules add column game_category text
  check (game_category is null or game_category in ('練習試合', '公式戦'));
