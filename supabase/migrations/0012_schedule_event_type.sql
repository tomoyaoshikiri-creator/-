-- 予定の種別に「イベント」を追加する(練習・試合のどちらにも当たらない予定用)。

alter table public.schedules drop constraint schedules_type_check;
alter table public.schedules
  add constraint schedules_type_check check (type in ('practice', 'game', 'event'));
