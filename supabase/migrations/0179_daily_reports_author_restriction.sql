begin;

-- チーム日報(daily_reports)のUPDATE/DELETEが、これまでteam_idチェックのみで
-- 著者・ロールの制限が無く、一般(保護者)を含め誰でも他人の日報を編集・削除できて
-- しまっていた。INSERTはauthor_id = auth.uid()に限定されているのに揃っていなかった
-- (ユーザー指摘によるRLS監査で発見)。library_items/library_filesと同じパターン
-- (アップロード本人 or スタッフ)で、著者本人 or 指導者・管理者に限定する。

drop policy daily_reports_update on public.daily_reports;
create policy daily_reports_update on public.daily_reports for update
  using (
    team_id = public.current_team_id()
    and (author_id = auth.uid() or public.current_role() in ('指導者', '管理者'))
  )
  with check (team_id = public.current_team_id());

drop policy daily_reports_delete on public.daily_reports;
create policy daily_reports_delete on public.daily_reports for delete
  using (
    team_id = public.current_team_id()
    and (author_id = auth.uid() or public.current_role() in ('指導者', '管理者'))
  );

commit;
