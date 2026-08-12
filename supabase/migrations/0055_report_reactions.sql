-- 練習日報にも、お知らせ・選手メモと同じスタンプ機能(👍/🙆‍♂️/🙇/🙏)を追加する。
-- reportsは全ロールがチーム内で閲覧・登録できる(audienceのような公開範囲の絞り込みが無い)ため、
-- notice_reactionsと違ってRLSはteam_id一致だけのシンプルな形でよい。

create table public.report_reactions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  report_id uuid not null references public.reports(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('thumbs_up', 'ok_gesture', 'bow', 'pray')),
  created_at timestamptz not null default now(),
  unique (report_id, profile_id, reaction_type)
);

alter table public.report_reactions enable row level security;

create policy report_reactions_select on public.report_reactions for select
  using (team_id = public.current_team_id());

create policy report_reactions_insert on public.report_reactions for insert
  with check (
    team_id = public.current_team_id()
    and profile_id = auth.uid()
    and exists (
      select 1 from public.reports r
      where r.id = report_reactions.report_id and r.team_id = public.current_team_id()
    )
  );

-- 削除は自分が押したスタンプのみ。
create policy report_reactions_delete on public.report_reactions for delete
  using (profile_id = auth.uid());
