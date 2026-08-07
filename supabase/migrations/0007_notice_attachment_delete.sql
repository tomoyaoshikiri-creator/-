-- お知らせの添付資料を編集画面から削除できるようにするためのDELETEポリシー。

create policy notice_attachments_delete on public.notice_attachments for delete
  using (
    exists (
      select 1 from public.notices n
      where n.id = notice_id
        and n.team_id = public.current_team_id()
        and public.current_role() in ('一般', '役員', '指導者', '管理者')
    )
  );

create policy notice_attachments_storage_delete on storage.objects for delete
  using (
    bucket_id = 'notice-attachments'
    and (storage.foldername(name))[1] = public.current_team_id()::text
    and public.current_role() in ('一般', '役員', '指導者', '管理者')
  );
