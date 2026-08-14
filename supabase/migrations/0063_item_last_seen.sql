-- 予定編集の検知用に更新日時を追加する(出欠登録は既にattendances.updated_atで検知できている)。
alter table public.schedules add column updated_at timestamptz not null default now();

-- 項目ごとの既読管理。タブ単位のtab_last_seenでは一覧の中の「どれが新着か」までは分からないため、
-- 予定・選手メモ・分析フィードバックなど、一覧から個別に辿れるものはこちらに切り替える。
-- item_type: 'schedule'(item_id=schedules.id) / 'player_notes'(item_id=players.id) /
--           'player_analysis'(item_id=players.id) / 'team_analysis'(item_id=teams.id)
create table public.item_last_seen (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null,
  item_id uuid not null,
  seen_at timestamptz not null default now(),
  primary key (user_id, item_type, item_id)
);

alter table public.item_last_seen enable row level security;

create policy item_last_seen_select on public.item_last_seen for select
  using (user_id = auth.uid());
create policy item_last_seen_insert on public.item_last_seen for insert
  with check (user_id = auth.uid());
create policy item_last_seen_update on public.item_last_seen for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
