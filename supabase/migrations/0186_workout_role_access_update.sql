begin;

-- ワークアウト配下の権限見直し(ユーザー指示)。
-- コービーシューティング: 運営の編集権限を外し、指導者・管理者のみにする
--   (閲覧は従来通り指導者・管理者+紐づく選手の保護者)。
-- シェービングドリル: 選手に紐づかないチーム全体の記録のため、全ロールに開放する。

alter policy shooting_drill_records_select on public.shooting_drill_records
  using (
    team_id = public.current_team_id()
    and (
      public.current_role() in ('指導者', '管理者')
      or exists (
        select 1 from public.player_guardians pg
        where pg.player_id = shooting_drill_records.player_id and pg.profile_id = (select auth.uid())
      )
    )
  );

alter policy shooting_drill_records_insert on public.shooting_drill_records
  with check (
    team_id = public.current_team_id()
    and public.current_role() in ('指導者', '管理者')
    and recorded_by = (select auth.uid())
  );

alter policy shooting_drill_records_update on public.shooting_drill_records
  using (
    team_id = public.current_team_id()
    and public.current_role() in ('指導者', '管理者')
  )
  with check (team_id = public.current_team_id());

alter policy shooting_drill_records_delete on public.shooting_drill_records
  using (
    team_id = public.current_team_id()
    and public.current_role() in ('指導者', '管理者')
  );

alter policy shaving_drill_records_select on public.shaving_drill_records
  using (team_id = public.current_team_id());

alter policy shaving_drill_records_insert on public.shaving_drill_records
  with check (
    team_id = public.current_team_id()
    and recorded_by = (select auth.uid())
  );

alter policy shaving_drill_records_update on public.shaving_drill_records
  using (team_id = public.current_team_id())
  with check (team_id = public.current_team_id());

alter policy shaving_drill_records_delete on public.shaving_drill_records
  using (team_id = public.current_team_id());

commit;
