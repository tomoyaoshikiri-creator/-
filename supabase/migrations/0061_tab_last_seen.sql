-- タブの新着通知(未読の赤丸)用。個別のメモ・お知らせ単位の既読管理はせず、
-- 「そのタブを最後に開いた日時」より新しい他人の投稿があるかどうかだけを見る軽量な方式にする。
create table public.tab_last_seen (
  user_id uuid not null references public.profiles(id) on delete cascade,
  tab text not null,
  seen_at timestamptz not null default now(),
  primary key (user_id, tab)
);

alter table public.tab_last_seen enable row level security;

create policy tab_last_seen_select on public.tab_last_seen for select
  using (user_id = auth.uid());
create policy tab_last_seen_insert on public.tab_last_seen for insert
  with check (user_id = auth.uid());
create policy tab_last_seen_update on public.tab_last_seen for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 選手メモの「編集」も新着判定の対象にするため、更新日時を追加する
-- (これまでは新規登録時のcreated_atしか持たず、編集は検知できなかった)。
alter table public.player_notes add column updated_at timestamptz not null default now();
