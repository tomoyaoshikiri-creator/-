begin;

-- 試合記録(game_matches、対戦結果を入力する画面)向けの「コーチメモ」機能。
-- 選手メモ(player_notes/player_note_reactions、0001_init.sql・0021・0041・0042)と
-- 全く同じ構造(記入者名+スタンプ、指導者・管理者のみ閲覧・投稿・編集・削除可)を
-- game_matches単位で複製する。編集・削除は記入者本人に限らずチーム内の指導者・管理者
-- であれば可能(player_notesと同じ方針)。

create table public.game_match_notes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  game_match_id uuid not null references public.game_matches(id) on delete cascade,
  author_id uuid references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index game_match_notes_game_match_id_idx on public.game_match_notes(game_match_id, created_at desc);

alter table public.game_match_notes enable row level security;

create policy game_match_notes_select on public.game_match_notes for select
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));

create policy game_match_notes_insert on public.game_match_notes for insert
  with check (
    team_id = public.current_team_id()
    and public.current_role() in ('指導者', '管理者')
    and author_id = auth.uid()
  );

create policy game_match_notes_update on public.game_match_notes for update
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'))
  with check (team_id = public.current_team_id());

create policy game_match_notes_delete on public.game_match_notes for delete
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));

-- スタンプ(リアクション)。種別・制約はplayer_note_reactionsと完全に同一にする。
create table public.game_match_note_reactions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  note_id uuid not null references public.game_match_notes(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('thumbs_up', 'ok_gesture', 'bow', 'pray')),
  created_at timestamptz not null default now(),
  unique (note_id, profile_id, reaction_type)
);

alter table public.game_match_note_reactions enable row level security;

create policy game_match_note_reactions_select on public.game_match_note_reactions for select
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));

create policy game_match_note_reactions_insert on public.game_match_note_reactions for insert
  with check (
    team_id = public.current_team_id()
    and public.current_role() in ('指導者', '管理者')
    and profile_id = auth.uid()
  );

-- 削除は自分が押したスタンプのみ(他人のスタンプは取り消せない、player_note_reactionsと同じ)。
create policy game_match_note_reactions_delete on public.game_match_note_reactions for delete
  using (profile_id = auth.uid());

commit;
