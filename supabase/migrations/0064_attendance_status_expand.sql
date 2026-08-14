-- 練習の出欠を「出席・欠席」の2択から「出席・欠席・遅刻早退・見学」の4択に拡張する。
-- 試合の出欠は引き続き画面上は出席・欠席の2択のみ(UI側で制御)。
alter table public.attendances drop constraint if exists attendances_status_check;
alter table public.attendances
  add constraint attendances_status_check check (status in ('出席', '欠席', '遅刻早退', '見学'));
