-- 練習日報へのコメント機能。reportsと同じくチーム内は全ロールが閲覧・投稿できる
-- (report_reactionsと同じ考え方。0055参照)。
create table public.report_comments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  report_id uuid not null references public.reports(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index report_comments_report_id_idx on public.report_comments(report_id, created_at asc);

alter table public.report_comments enable row level security;

create policy report_comments_select on public.report_comments for select
  using (team_id = public.current_team_id());

create policy report_comments_insert on public.report_comments for insert
  with check (
    team_id = public.current_team_id()
    and profile_id = auth.uid()
    and exists (
      select 1 from public.reports r
      where r.id = report_comments.report_id and r.team_id = public.current_team_id()
    )
  );

-- 編集・削除は自分が書いたコメントのみ。
create policy report_comments_update on public.report_comments for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy report_comments_delete on public.report_comments for delete
  using (profile_id = auth.uid());
