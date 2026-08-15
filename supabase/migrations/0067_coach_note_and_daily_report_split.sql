-- 「日報」を2つに分割する。
-- 既存のreports/report_reactions/report_commentsは、これまでの投稿をそのまま引き継いで
-- 「コーチノート」(指導者・管理者専用、コーチがその日の練習で思ったことを書く場所)にする。
-- 新たにdaily_reports/daily_report_reactions/daily_report_commentsを作り、こちらを
-- 全ロール共有の「日報」として運用する(既存のreports系が持っていた全ロール向けのRLSをそのまま引き継ぐ)。

-- 1) 既存reports系を指導者・管理者専用に絞る -----------------------------------

drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports for select
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));

drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert
  with check (
    team_id = public.current_team_id()
    and author_id = auth.uid()
    and public.current_role() in ('指導者', '管理者')
  );

drop policy if exists reports_update on public.reports;
create policy reports_update on public.reports for update
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'))
  with check (team_id = public.current_team_id());

drop policy if exists reports_delete on public.reports;
create policy reports_delete on public.reports for delete
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));

drop policy if exists report_reactions_select on public.report_reactions;
create policy report_reactions_select on public.report_reactions for select
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));

drop policy if exists report_reactions_insert on public.report_reactions;
create policy report_reactions_insert on public.report_reactions for insert
  with check (
    team_id = public.current_team_id()
    and profile_id = auth.uid()
    and public.current_role() in ('指導者', '管理者')
    and exists (
      select 1 from public.reports r
      where r.id = report_reactions.report_id and r.team_id = public.current_team_id()
    )
  );

drop policy if exists report_comments_select on public.report_comments;
create policy report_comments_select on public.report_comments for select
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));

drop policy if exists report_comments_insert on public.report_comments;
create policy report_comments_insert on public.report_comments for insert
  with check (
    team_id = public.current_team_id()
    and profile_id = auth.uid()
    and public.current_role() in ('指導者', '管理者')
    and exists (
      select 1 from public.reports r
      where r.id = report_comments.report_id and r.team_id = public.current_team_id()
    )
  );

-- 2) 新規: 全ロール共有の「日報」用テーブル(既存reports系の元の構造・RLSをそのまま複製) --------

create table public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  date date not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.daily_reports enable row level security;

create policy daily_reports_select on public.daily_reports for select
  using (team_id = public.current_team_id());
create policy daily_reports_insert on public.daily_reports for insert
  with check (team_id = public.current_team_id() and author_id = auth.uid());
create policy daily_reports_update on public.daily_reports for update
  using (team_id = public.current_team_id())
  with check (team_id = public.current_team_id());
create policy daily_reports_delete on public.daily_reports for delete
  using (team_id = public.current_team_id());

create table public.daily_report_reactions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  daily_report_id uuid not null references public.daily_reports(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('thumbs_up', 'ok_gesture', 'bow', 'pray')),
  created_at timestamptz not null default now(),
  unique (daily_report_id, profile_id, reaction_type)
);

alter table public.daily_report_reactions enable row level security;

create policy daily_report_reactions_select on public.daily_report_reactions for select
  using (team_id = public.current_team_id());
create policy daily_report_reactions_insert on public.daily_report_reactions for insert
  with check (
    team_id = public.current_team_id()
    and profile_id = auth.uid()
    and exists (
      select 1 from public.daily_reports r
      where r.id = daily_report_reactions.daily_report_id and r.team_id = public.current_team_id()
    )
  );
create policy daily_report_reactions_delete on public.daily_report_reactions for delete
  using (profile_id = auth.uid());

create table public.daily_report_comments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  daily_report_id uuid not null references public.daily_reports(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index daily_report_comments_daily_report_id_idx on public.daily_report_comments(daily_report_id, created_at asc);

alter table public.daily_report_comments enable row level security;

create policy daily_report_comments_select on public.daily_report_comments for select
  using (team_id = public.current_team_id());
create policy daily_report_comments_insert on public.daily_report_comments for insert
  with check (
    team_id = public.current_team_id()
    and profile_id = auth.uid()
    and exists (
      select 1 from public.daily_reports r
      where r.id = daily_report_comments.daily_report_id and r.team_id = public.current_team_id()
    )
  );
create policy daily_report_comments_update on public.daily_report_comments for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
create policy daily_report_comments_delete on public.daily_report_comments for delete
  using (profile_id = auth.uid());
