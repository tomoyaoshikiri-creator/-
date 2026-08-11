-- スポーツテスト記録を、指導者・管理者に加えて紐付いた保護者本人も
-- (自分の子どもの分だけ)閲覧・入力できるようにする。
-- 選手が紙の台紙で自己測定した数値を、保護者がそのままアプリに入力できるようにするため。
drop policy if exists sports_test_records_select on public.sports_test_records;
create policy sports_test_records_select on public.sports_test_records for select
  using (
    team_id = public.current_team_id()
    and (
      public.current_role() in ('指導者', '管理者')
      or exists (
        select 1 from public.player_guardians pg
        where pg.player_id = sports_test_records.player_id and pg.profile_id = auth.uid()
      )
    )
  );

drop policy if exists sports_test_records_insert on public.sports_test_records;
create policy sports_test_records_insert on public.sports_test_records for insert
  with check (
    team_id = public.current_team_id()
    and (
      public.current_role() in ('指導者', '管理者')
      or exists (
        select 1 from public.player_guardians pg
        where pg.player_id = sports_test_records.player_id and pg.profile_id = auth.uid()
      )
    )
  );

drop policy if exists sports_test_records_update on public.sports_test_records;
create policy sports_test_records_update on public.sports_test_records for update
  using (
    team_id = public.current_team_id()
    and (
      public.current_role() in ('指導者', '管理者')
      or exists (
        select 1 from public.player_guardians pg
        where pg.player_id = sports_test_records.player_id and pg.profile_id = auth.uid()
      )
    )
  )
  with check (team_id = public.current_team_id());

drop policy if exists sports_test_records_delete on public.sports_test_records;
create policy sports_test_records_delete on public.sports_test_records for delete
  using (
    team_id = public.current_team_id()
    and (
      public.current_role() in ('指導者', '管理者')
      or exists (
        select 1 from public.player_guardians pg
        where pg.player_id = sports_test_records.player_id and pg.profile_id = auth.uid()
      )
    )
  );
