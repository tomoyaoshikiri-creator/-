-- 権限「役員」を「運営」に名称変更する。表示だけでなく、データベース上の値・
-- チェック制約・RLSポリシー(current_role() = '役員' などのリテラル比較)を
-- すべて '運営' に置き換える。お知らせの公開範囲「役員以上」も「運営以上」に変更する。
-- current_role()自体はprofiles.roleをそのまま返すだけなので変更不要(0001_init.sql参照)。

-- =========================================================
-- 1. profiles.role: 既存データとチェック制約を更新
-- =========================================================
alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = '運営' where role = '役員';
alter table public.profiles
  add constraint profiles_role_check check (role in ('一般', '運営', '指導者', '管理者'));

-- =========================================================
-- 2. notices.audience: 既存データとチェック制約を更新(役員以上→運営以上)
-- =========================================================
alter table public.notices drop constraint if exists notices_audience_check;
update public.notices set audience = '運営以上' where audience = '役員以上';
alter table public.notices
  add constraint notices_audience_check check (audience in ('全員', '指導者のみ', '運営以上', '学年指定'));

-- =========================================================
-- 3. invites (0031_invite_officer_and_revoke.sql の再定義)
-- =========================================================
drop policy if exists invites_select on public.invites;
create policy invites_select on public.invites for select
  using (
    team_id = public.current_team_id()
    and (
      public.current_role() in ('指導者', '管理者')
      or (public.current_role() = '運営' and role = '一般')
    )
  );

drop policy if exists invites_insert on public.invites;
create policy invites_insert on public.invites for insert
  with check (
    team_id = public.current_team_id()
    and created_by = auth.uid()
    and (
      public.current_role() in ('指導者', '管理者')
      or (public.current_role() = '運営' and role = '一般')
    )
  );

-- =========================================================
-- 4. schedules (0006/0028 の再定義)
-- =========================================================
drop policy if exists schedules_insert on public.schedules;
create policy schedules_insert on public.schedules for insert
  with check (
    team_id = public.current_team_id()
    and public.current_role() in ('一般', '運営', '指導者', '管理者')
  );

drop policy if exists schedules_update on public.schedules;
create policy schedules_update on public.schedules for update
  using (
    team_id = public.current_team_id()
    and public.current_role() in ('一般', '運営', '指導者', '管理者')
  )
  with check (team_id = public.current_team_id());

drop policy if exists schedules_delete on public.schedules;
create policy schedules_delete on public.schedules for delete
  using (
    team_id = public.current_team_id()
    and public.current_role() in ('一般', '運営', '指導者', '管理者')
  );

-- =========================================================
-- 5. notices (0006/0009/0027 の再定義)
-- =========================================================
drop policy if exists notices_insert on public.notices;
create policy notices_insert on public.notices for insert
  with check (
    team_id = public.current_team_id()
    and public.current_role() in ('一般', '運営', '指導者', '管理者')
    and sender_id = auth.uid()
  );

drop policy if exists notices_update on public.notices;
create policy notices_update on public.notices for update
  using (
    team_id = public.current_team_id()
    and public.current_role() in ('一般', '運営', '指導者', '管理者')
  )
  with check (team_id = public.current_team_id());

drop policy if exists notices_delete on public.notices;
create policy notices_delete on public.notices for delete
  using (
    team_id = public.current_team_id()
    and public.current_role() in ('一般', '運営', '指導者', '管理者')
  );

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

-- =========================================================
-- 6. notice_attachments (0007/0008 の再定義)
-- =========================================================
drop policy if exists notice_attachments_insert on public.notice_attachments;
create policy notice_attachments_insert on public.notice_attachments for insert
  with check (
    exists (
      select 1 from public.notices n
      where n.id = notice_id
        and n.team_id = public.current_team_id()
        and public.current_role() in ('一般', '運営', '指導者', '管理者')
    )
  );

drop policy if exists notice_attachments_delete on public.notice_attachments;
create policy notice_attachments_delete on public.notice_attachments for delete
  using (
    exists (
      select 1 from public.notices n
      where n.id = notice_id
        and n.team_id = public.current_team_id()
        and public.current_role() in ('一般', '運営', '指導者', '管理者')
    )
  );

-- =========================================================
-- 7. storage.objects (notice-attachments バケット、0001/0007 の再定義)
-- =========================================================
drop policy if exists notice_attachments_storage_insert on storage.objects;
create policy notice_attachments_storage_insert on storage.objects for insert
  with check (
    bucket_id = 'notice-attachments'
    and (storage.foldername(name))[1] = public.current_team_id()::text
    and public.current_role() in ('運営', '指導者', '管理者')
  );

drop policy if exists notice_attachments_storage_delete on storage.objects;
create policy notice_attachments_storage_delete on storage.objects for delete
  using (
    bucket_id = 'notice-attachments'
    and (storage.foldername(name))[1] = public.current_team_id()::text
    and public.current_role() in ('一般', '運営', '指導者', '管理者')
  );

-- =========================================================
-- 8. player_guardians (0014 の再定義)
-- =========================================================
drop policy if exists player_guardians_select on public.player_guardians;
create policy player_guardians_select on public.player_guardians for select
  using (
    team_id = public.current_team_id()
    and (profile_id = auth.uid() or public.current_role() in ('運営', '指導者', '管理者'))
  );

-- =========================================================
-- 9. players (0056 の再定義、保護者・運営向けの閲覧ポリシー)
-- =========================================================
drop policy if exists players_select_guardian_view on public.players;
create policy players_select_guardian_view on public.players for select
  using (
    team_id = public.current_team_id()
    and public.current_role() in ('一般', '運営')
  );

-- =========================================================
-- 10. notice_reactions (0043 の再定義)
-- =========================================================
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
