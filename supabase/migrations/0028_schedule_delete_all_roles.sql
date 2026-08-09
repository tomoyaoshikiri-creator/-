-- 予定の登録・編集(schedules_insert/update)は一般権限にも解放済みだが、削除(DELETE)は
-- 役員以上のみに制限されたままだった。編集画面から削除できるようにするのに合わせて、
-- お知らせ(notices_delete)と同じく登録・編集と同じロール範囲(全ロール)まで広げる。
drop policy if exists schedules_delete on public.schedules;
create policy schedules_delete on public.schedules for delete
  using (
    team_id = public.current_team_id()
    and public.current_role() in ('一般', '役員', '指導者', '管理者')
  );
