-- お知らせの公開範囲(audience)を追加する。指導者・管理者は常に全てのお知らせを閲覧できる
-- (チーム運営を見渡す立場のため)。一般・役員はaudienceに応じて絞り込まれる。
alter table public.notices add column audience text not null default '全員'
  check (audience in ('全員', '指導者のみ', '役員以上', '学年指定'));
alter table public.notices add column target_grade_min text;
alter table public.notices add constraint notices_target_grade_min_check
  check (audience <> '学年指定' or target_grade_min is not null);

drop policy notices_select on public.notices;
create policy notices_select on public.notices for select
using (
  team_id = public.current_team_id()
  and (
    public.current_role() in ('指導者', '管理者')
    or audience = '全員'
    or (audience = '役員以上' and public.current_role() = '役員')
    or (
      audience = '学年指定'
      and exists (
        select 1
        from public.player_guardians pg
        join public.players p on p.id = pg.player_id
        where pg.profile_id = auth.uid()
          and p.status = '在籍'
          and p.grade is not null
          and target_grade_min is not null
          and p.grade::int >= target_grade_min::int
      )
    )
  )
);
