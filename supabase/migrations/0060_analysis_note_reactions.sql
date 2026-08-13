-- 分析メモ(チーム分析メモ・選手分析メモ)に、選手メモと同じスタンプ(リアクション)機能をつける。
-- 1人が同じメモに複数種類のスタンプを押せる(同じ種類は1人1回まで)。
create table public.team_analysis_note_reactions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  note_id uuid not null references public.team_analysis_notes(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('thumbs_up', 'ok_gesture', 'bow', 'pray')),
  created_at timestamptz not null default now(),
  unique (note_id, profile_id, reaction_type)
);

create table public.player_analysis_note_reactions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  note_id uuid not null references public.player_analysis_notes(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('thumbs_up', 'ok_gesture', 'bow', 'pray')),
  created_at timestamptz not null default now(),
  unique (note_id, profile_id, reaction_type)
);

alter table public.team_analysis_note_reactions enable row level security;
alter table public.player_analysis_note_reactions enable row level security;

-- 閲覧はメモ本体と同じく指導者・管理者のみ。削除は自分が押したスタンプのみ。
create policy team_analysis_note_reactions_select on public.team_analysis_note_reactions for select
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));
create policy team_analysis_note_reactions_insert on public.team_analysis_note_reactions for insert
  with check (
    team_id = public.current_team_id()
    and public.current_role() in ('指導者', '管理者')
    and profile_id = auth.uid()
  );
create policy team_analysis_note_reactions_delete on public.team_analysis_note_reactions for delete
  using (profile_id = auth.uid());

create policy player_analysis_note_reactions_select on public.player_analysis_note_reactions for select
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));
create policy player_analysis_note_reactions_insert on public.player_analysis_note_reactions for insert
  with check (
    team_id = public.current_team_id()
    and public.current_role() in ('指導者', '管理者')
    and profile_id = auth.uid()
  );
create policy player_analysis_note_reactions_delete on public.player_analysis_note_reactions for delete
  using (profile_id = auth.uid());
