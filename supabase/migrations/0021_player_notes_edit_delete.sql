-- 選手メモの編集・削除を、閲覧・登録権限と同じ指導者・管理者に許可する(お知らせと同様、
-- 記入者本人に限らずチーム内の指導者・管理者であれば編集・削除できる)。
create policy player_notes_update on public.player_notes for update
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'))
  with check (team_id = public.current_team_id());

create policy player_notes_delete on public.player_notes for delete
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));
