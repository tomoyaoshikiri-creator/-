-- 予定ごとに「終日」を選べるようにする(既定はOFF、全種別対象)。ONの予定は
-- start_time/end_timeを使わず(登録・編集フォーム側でnullにする)、一覧・詳細では
-- 「終日」と表示する。
alter table public.schedules add column is_all_day boolean not null default false;
