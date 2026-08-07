-- お知らせの削除(編集画面から)用のポリシー。
-- notice_attachments は notices への外部キーに on delete cascade が設定済みのため、
-- お知らせを削除すれば添付資料の行も自動的に削除される(Storage上のファイル本体は
-- アプリ側で個別に削除する)。

create policy notices_delete on public.notices for delete
  using (
    team_id = public.current_team_id()
    and public.current_role() in ('一般', '役員', '指導者', '管理者')
  );
