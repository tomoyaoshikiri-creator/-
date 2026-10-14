begin;

-- player_growth_records(身長・体重記録)のUPDATE/DELETEに、チームの確認が
-- 抜けていた(RLS監査で発見)。role IN ('指導者','管理者')の分岐にteam_idの
-- 確認が無く、他チームの指導者・管理者が別チームの記録を削除・更新できてしまう
-- 状態だった。同じ形のsports_test_records_delete/updateと同じパターン
-- (team_id = current_team_id() AND (...))に揃える。

drop policy player_growth_records_delete on public.player_growth_records;
create policy player_growth_records_delete on public.player_growth_records for delete
  using (
    team_id = public.current_team_id()
    and (
      public.current_role() in ('指導者', '管理者')
      or exists (
        select 1 from public.player_guardians pg
        where pg.player_id = player_growth_records.player_id and pg.profile_id = auth.uid()
      )
    )
  );

drop policy player_growth_records_update on public.player_growth_records;
create policy player_growth_records_update on public.player_growth_records for update
  using (
    team_id = public.current_team_id()
    and (
      public.current_role() in ('指導者', '管理者')
      or exists (
        select 1 from public.player_guardians pg
        where pg.player_id = player_growth_records.player_id and pg.profile_id = auth.uid()
      )
    )
  )
  with check (team_id = public.current_team_id());

commit;
