-- 練習日報の閲覧・登録を指導者・管理者のみに制限する(これまでは全ロールが閲覧・登録可能だった)。
drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports for select
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));

drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert
  with check (
    team_id = public.current_team_id()
    and author_id = auth.uid()
    and public.current_role() in ('指導者', '管理者')
  );
