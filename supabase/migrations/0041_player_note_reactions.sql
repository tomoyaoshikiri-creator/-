-- 選手メモに他の指導者・管理者がスタンプ(リアクション)を押せるようにする。
-- 1人が同じメモに複数種類のスタンプを押せる(同じ種類は1人1回まで)。
create table public.player_note_reactions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  note_id uuid not null references public.player_notes(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('thumbs_up', 'ok_gesture', 'bow')),
  created_at timestamptz not null default now(),
  unique (note_id, profile_id, reaction_type)
);

alter table public.player_note_reactions enable row level security;

-- 閲覧は選手メモ本体と同じく指導者・管理者のみ。
create policy player_note_reactions_select on public.player_note_reactions for select
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));

create policy player_note_reactions_insert on public.player_note_reactions for insert
  with check (
    team_id = public.current_team_id()
    and public.current_role() in ('指導者', '管理者')
    and profile_id = auth.uid()
  );

-- 削除は自分が押したスタンプのみ(他人のスタンプは取り消せない)。
create policy player_note_reactions_delete on public.player_note_reactions for delete
  using (profile_id = auth.uid());
