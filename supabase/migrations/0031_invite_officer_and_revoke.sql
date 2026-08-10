-- 役員にも「ユーザー管理」タブの招待リンク発行部分だけを開放する。役員が発行・閲覧できるのは
-- 保護者用(role='一般')の招待リンクのみとし、指導者用の招待リンクは指導者・管理者だけが
-- 発行・閲覧できるようにする(役員が指導者用リンクを使って自分を指導者に登録できてしまうのを防ぐ)。
drop policy if exists invites_select on public.invites;
create policy invites_select on public.invites for select
  using (
    team_id = public.current_team_id()
    and (
      public.current_role() in ('指導者', '管理者')
      or (public.current_role() = '役員' and role = '一般')
    )
  );

drop policy if exists invites_insert on public.invites;
create policy invites_insert on public.invites for insert
  with check (
    team_id = public.current_team_id()
    and created_by = auth.uid()
    and (
      public.current_role() in ('指導者', '管理者')
      or (public.current_role() = '役員' and role = '一般')
    )
  );

-- 招待リンクの取り消し(削除)は管理者のみ。
create policy invites_delete on public.invites for delete
  using (team_id = public.current_team_id() and public.current_role() = '管理者');
