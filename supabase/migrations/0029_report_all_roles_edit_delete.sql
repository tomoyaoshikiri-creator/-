-- 練習日報を再び全ロールが閲覧・登録できるようにする(0020で指導者・管理者限定にしたのを戻す)。
-- あわせて編集・削除のポリシーが元々無かったため追加する。お知らせと同じく、記入者本人に限らず
-- チーム内の全ロールが編集・削除できる(共有ログとしての性質を優先する)。
drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports for select
  using (team_id = public.current_team_id());

drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert
  with check (team_id = public.current_team_id() and author_id = auth.uid());

create policy reports_update on public.reports for update
  using (team_id = public.current_team_id())
  with check (team_id = public.current_team_id());

create policy reports_delete on public.reports for delete
  using (team_id = public.current_team_id());
