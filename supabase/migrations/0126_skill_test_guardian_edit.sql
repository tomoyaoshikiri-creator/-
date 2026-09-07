begin;

-- 検定の記録(追記)を、指導者・管理者に加えて紐づく保護者本人も
-- (自分の子どもの分だけ)行えるようにする。sports_test_records(0040)と同じ方針。
drop policy if exists player_skill_test_progress_insert on public.player_skill_test_progress;
create policy player_skill_test_progress_insert on public.player_skill_test_progress for insert
  with check (
    team_id = public.current_team_id()
    and (
      public.current_role() in ('指導者', '管理者')
      or exists (
        select 1 from public.player_guardians pg
        where pg.player_id = player_skill_test_progress.player_id and pg.profile_id = auth.uid()
      )
    )
    and recorded_by = auth.uid()
  );

commit;
