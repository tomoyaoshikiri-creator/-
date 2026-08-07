-- notice_attachments の登録が「お知らせの発信者本人のみ」に制限されていたため、
-- 予定・お知らせの編集を一般権限にも解放した後(0006)でも、発信者以外が編集画面から
-- 添付資料を追加すると失敗していた。書き込み権限のあるチームメンバーなら誰でも
-- 追加できるように緩和する。

drop policy if exists notice_attachments_insert on public.notice_attachments;
create policy notice_attachments_insert on public.notice_attachments for insert
  with check (
    exists (
      select 1 from public.notices n
      where n.id = notice_id
        and n.team_id = public.current_team_id()
        and public.current_role() in ('一般', '役員', '指導者', '管理者')
    )
  );
