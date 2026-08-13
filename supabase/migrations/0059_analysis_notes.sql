-- 「分析用抽出」でAIに分析してもらった結果を残しておくためのメモ機能。
-- チーム全体向け(team_analysis_notes)と選手個人向け(player_analysis_notes)の2つを、
-- player_notesと同じ構造・権限(閲覧・登録・編集・削除とも指導者・管理者のみ)で用意する。

create table public.team_analysis_notes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  author_id uuid references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);
create index team_analysis_notes_team_id_idx on public.team_analysis_notes(team_id, created_at desc);

create table public.player_analysis_notes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  author_id uuid references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);
create index player_analysis_notes_player_id_idx on public.player_analysis_notes(player_id, created_at desc);

alter table public.team_analysis_notes enable row level security;
alter table public.player_analysis_notes enable row level security;

create policy team_analysis_notes_select on public.team_analysis_notes for select
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));
create policy team_analysis_notes_insert on public.team_analysis_notes for insert
  with check (
    team_id = public.current_team_id()
    and public.current_role() in ('指導者', '管理者')
    and author_id = auth.uid()
  );
create policy team_analysis_notes_update on public.team_analysis_notes for update
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'))
  with check (team_id = public.current_team_id());
create policy team_analysis_notes_delete on public.team_analysis_notes for delete
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));

create policy player_analysis_notes_select on public.player_analysis_notes for select
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));
create policy player_analysis_notes_insert on public.player_analysis_notes for insert
  with check (
    team_id = public.current_team_id()
    and public.current_role() in ('指導者', '管理者')
    and author_id = auth.uid()
  );
create policy player_analysis_notes_update on public.player_analysis_notes for update
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'))
  with check (team_id = public.current_team_id());
create policy player_analysis_notes_delete on public.player_analysis_notes for delete
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));
