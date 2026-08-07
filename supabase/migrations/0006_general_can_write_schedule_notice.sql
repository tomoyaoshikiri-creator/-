-- 予定・お知らせの登録を一般権限にも解放し、編集(UPDATE)用のポリシーを整備する。

drop policy if exists schedules_insert on public.schedules;
create policy schedules_insert on public.schedules for insert
  with check (
    team_id = public.current_team_id()
    and public.current_role() in ('一般', '役員', '指導者', '管理者')
  );

drop policy if exists schedules_update on public.schedules;
create policy schedules_update on public.schedules for update
  using (
    team_id = public.current_team_id()
    and public.current_role() in ('一般', '役員', '指導者', '管理者')
  )
  with check (team_id = public.current_team_id());

drop policy if exists notices_insert on public.notices;
create policy notices_insert on public.notices for insert
  with check (
    team_id = public.current_team_id()
    and public.current_role() in ('一般', '役員', '指導者', '管理者')
    and sender_id = auth.uid()
  );

create policy notices_update on public.notices for update
  using (
    team_id = public.current_team_id()
    and public.current_role() in ('一般', '役員', '指導者', '管理者')
  )
  with check (team_id = public.current_team_id());
