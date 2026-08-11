-- お知らせにも選手メモと同じスタンプ機能(👍/🙆‍♂️/🙇/🙏)を追加する。
-- 閲覧・押下できる人は、そのお知らせ自体を閲覧できる人と同じ(公開範囲によって絞り込む)。
create table public.notice_reactions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  notice_id uuid not null references public.notices(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('thumbs_up', 'ok_gesture', 'bow', 'pray')),
  created_at timestamptz not null default now(),
  unique (notice_id, profile_id, reaction_type)
);

alter table public.notice_reactions enable row level security;

create policy notice_reactions_select on public.notice_reactions for select
  using (
    exists (
      select 1 from public.notices n
      where n.id = notice_reactions.notice_id
        and n.team_id = public.current_team_id()
        and (
          public.current_role() in ('指導者', '管理者')
          or n.audience = '全員'
          or (n.audience = '役員以上' and public.current_role() = '役員')
          or (
            n.audience = '学年指定'
            and exists (
              select 1
              from public.player_guardians pg
              join public.players p on p.id = pg.player_id
              where pg.profile_id = auth.uid()
                and p.status = '在籍'
                and p.grade is not null
                and n.target_grade_min is not null
                and p.grade::int >= n.target_grade_min::int
            )
          )
        )
    )
  );

create policy notice_reactions_insert on public.notice_reactions for insert
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from public.notices n
      where n.id = notice_reactions.notice_id
        and n.team_id = public.current_team_id()
        and team_id = n.team_id
        and (
          public.current_role() in ('指導者', '管理者')
          or n.audience = '全員'
          or (n.audience = '役員以上' and public.current_role() = '役員')
          or (
            n.audience = '学年指定'
            and exists (
              select 1
              from public.player_guardians pg
              join public.players p on p.id = pg.player_id
              where pg.profile_id = auth.uid()
                and p.status = '在籍'
                and p.grade is not null
                and n.target_grade_min is not null
                and p.grade::int >= n.target_grade_min::int
            )
          )
        )
    )
  );

-- 削除は自分が押したスタンプのみ。
create policy notice_reactions_delete on public.notice_reactions for delete
  using (profile_id = auth.uid());
