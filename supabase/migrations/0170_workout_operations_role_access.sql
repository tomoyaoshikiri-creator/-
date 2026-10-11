begin;

-- コービーシューティング・シェービングドリル(ワークアウト配下)の閲覧・登録・編集・削除を
-- 運営にも開放する(これまで指導者・管理者限定。一般は対象外、ユーザー指示)。

alter policy shooting_drill_records_select on public.shooting_drill_records
  using (
    team_id = public.current_team_id()
    and (
      public.current_role() in ('運営', '指導者', '管理者')
      or exists (
        select 1 from public.player_guardians pg
        where pg.player_id = shooting_drill_records.player_id and pg.profile_id = auth.uid()
      )
    )
  );

alter policy shooting_drill_records_insert on public.shooting_drill_records
  with check (
    team_id = public.current_team_id()
    and public.current_role() in ('運営', '指導者', '管理者')
    and recorded_by = auth.uid()
  );

alter policy shooting_drill_records_update on public.shooting_drill_records
  using (
    team_id = public.current_team_id()
    and public.current_role() in ('運営', '指導者', '管理者')
  )
  with check (team_id = public.current_team_id());

alter policy shooting_drill_records_delete on public.shooting_drill_records
  using (
    team_id = public.current_team_id()
    and public.current_role() in ('運営', '指導者', '管理者')
  );

alter policy shaving_drill_records_select on public.shaving_drill_records
  using (
    team_id = public.current_team_id()
    and public.current_role() in ('運営', '指導者', '管理者')
  );

alter policy shaving_drill_records_insert on public.shaving_drill_records
  with check (
    team_id = public.current_team_id()
    and public.current_role() in ('運営', '指導者', '管理者')
    and recorded_by = auth.uid()
  );

alter policy shaving_drill_records_update on public.shaving_drill_records
  using (
    team_id = public.current_team_id()
    and public.current_role() in ('運営', '指導者', '管理者')
  )
  with check (team_id = public.current_team_id());

alter policy shaving_drill_records_delete on public.shaving_drill_records
  using (
    team_id = public.current_team_id()
    and public.current_role() in ('運営', '指導者', '管理者')
  );

commit;
