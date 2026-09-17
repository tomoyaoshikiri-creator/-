begin;

-- 「学年指定」のお知らせは、これまで在籍中の選手が学年条件を満たす保護者しか見えなかった。
-- そのため、紐づく選手が(在籍中のものが)1人もいない人(子が既に退団した保護者や、選手を
-- 持たない運営メンバーなど)は、学年条件の判定対象になりようがなく常に非表示になっていた。
-- これは「対象学年の絞り込み」という機能の趣旨からは外れる(絞り込みの対象外の人を巻き込んで
-- 隠してしまっている)ため、在籍中の選手が1人も紐づいていない人には学年に関わらず表示する
-- ように変更する。notices_select/notice_reactions_select/notice_reactions_insert/
-- notice_attachments_select/notice_attachments_storage_select/notice_audience_recipient_idsの
-- 6箇所すべてで同じ判定をミラーしている(0058, 0082, 0139参照)ため、揃えて変更する。
--
-- 併せて、notice_audience_recipient_ids(0139)がrole名変更(0058: 役員→運営、
-- audience「役員以上」→「運営以上」)に追従できておらず、'役員'/'役員以上'という
-- 現在は存在しない値のままだった不具合も修正する(「運営以上」で投稿したお知らせのPush通知が
-- 運営役割の誰にも届かない状態になっていた)。

drop policy if exists notices_select on public.notices;
create policy notices_select on public.notices for select
using (
  team_id = public.current_team_id()
  and (
    public.current_role() in ('指導者', '管理者')
    or audience = '全員'
    or (audience = '運営以上' and public.current_role() = '運営')
    or (
      audience = '学年指定'
      and (
        exists (
          select 1
          from public.player_guardians pg
          join public.players p on p.id = pg.player_id
          where pg.profile_id = auth.uid()
            and p.status = '在籍'
            and p.grade is not null
            and target_grade_min is not null
            and p.grade::int >= target_grade_min::int
        )
        or not exists (
          select 1
          from public.player_guardians pg
          join public.players p on p.id = pg.player_id
          where pg.profile_id = auth.uid()
            and p.status = '在籍'
        )
      )
    )
  )
);

drop policy if exists notice_reactions_select on public.notice_reactions;
create policy notice_reactions_select on public.notice_reactions for select
  using (
    exists (
      select 1 from public.notices n
      where n.id = notice_reactions.notice_id
        and n.team_id = public.current_team_id()
        and (
          public.current_role() in ('指導者', '管理者')
          or n.audience = '全員'
          or (n.audience = '運営以上' and public.current_role() = '運営')
          or (
            n.audience = '学年指定'
            and (
              exists (
                select 1
                from public.player_guardians pg
                join public.players p on p.id = pg.player_id
                where pg.profile_id = auth.uid()
                  and p.status = '在籍'
                  and p.grade is not null
                  and n.target_grade_min is not null
                  and p.grade::int >= n.target_grade_min::int
              )
              or not exists (
                select 1
                from public.player_guardians pg
                join public.players p on p.id = pg.player_id
                where pg.profile_id = auth.uid()
                  and p.status = '在籍'
              )
            )
          )
        )
    )
  );

drop policy if exists notice_reactions_insert on public.notice_reactions;
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
          or (n.audience = '運営以上' and public.current_role() = '運営')
          or (
            n.audience = '学年指定'
            and (
              exists (
                select 1
                from public.player_guardians pg
                join public.players p on p.id = pg.player_id
                where pg.profile_id = auth.uid()
                  and p.status = '在籍'
                  and p.grade is not null
                  and n.target_grade_min is not null
                  and p.grade::int >= n.target_grade_min::int
              )
              or not exists (
                select 1
                from public.player_guardians pg
                join public.players p on p.id = pg.player_id
                where pg.profile_id = auth.uid()
                  and p.status = '在籍'
              )
            )
          )
        )
    )
  );

drop policy if exists notice_attachments_select on public.notice_attachments;
create policy notice_attachments_select on public.notice_attachments for select
  using (
    exists (
      select 1 from public.notices n
      where n.id = notice_id
        and n.team_id = public.current_team_id()
        and (
          public.current_role() in ('指導者', '管理者')
          or n.audience = '全員'
          or (n.audience = '運営以上' and public.current_role() = '運営')
          or (
            n.audience = '学年指定'
            and (
              exists (
                select 1
                from public.player_guardians pg
                join public.players p on p.id = pg.player_id
                where pg.profile_id = auth.uid()
                  and p.status = '在籍'
                  and p.grade is not null
                  and n.target_grade_min is not null
                  and p.grade::int >= n.target_grade_min::int
              )
              or not exists (
                select 1
                from public.player_guardians pg
                join public.players p on p.id = pg.player_id
                where pg.profile_id = auth.uid()
                  and p.status = '在籍'
              )
            )
          )
        )
    )
  );

drop policy if exists notice_attachments_storage_select on storage.objects;
create policy notice_attachments_storage_select on storage.objects for select
  using (
    bucket_id = 'notice-attachments'
    and (storage.foldername(name))[1] = public.current_team_id()::text
    and exists (
      select 1 from public.notices n
      where n.id = ((storage.foldername(name))[2])::uuid
        and n.team_id = public.current_team_id()
        and (
          public.current_role() in ('指導者', '管理者')
          or n.audience = '全員'
          or (n.audience = '運営以上' and public.current_role() = '運営')
          or (
            n.audience = '学年指定'
            and (
              exists (
                select 1
                from public.player_guardians pg
                join public.players p on p.id = pg.player_id
                where pg.profile_id = auth.uid()
                  and p.status = '在籍'
                  and p.grade is not null
                  and n.target_grade_min is not null
                  and p.grade::int >= n.target_grade_min::int
              )
              or not exists (
                select 1
                from public.player_guardians pg
                join public.players p on p.id = pg.player_id
                where pg.profile_id = auth.uid()
                  and p.status = '在籍'
              )
            )
          )
        )
    )
  );

create or replace function public.notice_audience_recipient_ids(p_notice_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select tm.user_id
  from public.notices n
  join public.team_memberships tm on tm.team_id = n.team_id
  where n.id = p_notice_id
    and (
      tm.role in ('指導者', '管理者')
      or n.audience = '全員'
      or (n.audience = '運営以上' and tm.role = '運営')
      or (
        n.audience = '学年指定'
        and (
          exists (
            select 1
            from public.player_guardians pg
            join public.players p on p.id = pg.player_id
            where pg.profile_id = tm.user_id
              and p.status = '在籍'
              and p.grade is not null
              and n.target_grade_min is not null
              and p.grade::int >= n.target_grade_min::int
          )
          or not exists (
            select 1
            from public.player_guardians pg
            join public.players p on p.id = pg.player_id
            where pg.profile_id = tm.user_id
              and p.status = '在籍'
          )
        )
      )
    );
$$;

commit;
