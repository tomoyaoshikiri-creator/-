-- 日報・コーチノートのコメントにもスタンプを付けられるようにする。
-- report_comments(コーチノート用、指導者・管理者限定)とdaily_report_comments(日報用、全ロール)
-- それぞれのコメント単位で、report_reactions/daily_report_reactionsと同じ構造のリアクションを持つ。

create table public.report_comment_reactions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  comment_id uuid not null references public.report_comments(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('thumbs_up', 'ok_gesture', 'bow', 'pray')),
  created_at timestamptz not null default now(),
  unique (comment_id, profile_id, reaction_type)
);

alter table public.report_comment_reactions enable row level security;

create policy report_comment_reactions_select on public.report_comment_reactions for select
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));
create policy report_comment_reactions_insert on public.report_comment_reactions for insert
  with check (
    team_id = public.current_team_id()
    and profile_id = auth.uid()
    and public.current_role() in ('指導者', '管理者')
    and exists (
      select 1 from public.report_comments c
      where c.id = report_comment_reactions.comment_id and c.team_id = public.current_team_id()
    )
  );
create policy report_comment_reactions_delete on public.report_comment_reactions for delete
  using (profile_id = auth.uid());

create table public.daily_report_comment_reactions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  comment_id uuid not null references public.daily_report_comments(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('thumbs_up', 'ok_gesture', 'bow', 'pray')),
  created_at timestamptz not null default now(),
  unique (comment_id, profile_id, reaction_type)
);

alter table public.daily_report_comment_reactions enable row level security;

create policy daily_report_comment_reactions_select on public.daily_report_comment_reactions for select
  using (team_id = public.current_team_id());
create policy daily_report_comment_reactions_insert on public.daily_report_comment_reactions for insert
  with check (
    team_id = public.current_team_id()
    and profile_id = auth.uid()
    and exists (
      select 1 from public.daily_report_comments c
      where c.id = daily_report_comment_reactions.comment_id and c.team_id = public.current_team_id()
    )
  );
create policy daily_report_comment_reactions_delete on public.daily_report_comment_reactions for delete
  using (profile_id = auth.uid());
