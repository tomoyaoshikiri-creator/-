-- notice_attachments(お知らせの添付ファイル)のRLSが、お知らせ本体の公開範囲(audience)を
-- 見ていなかった不具合を修正する。これまではteam_idが一致するだけで、添付ファイルの
-- メタデータ・ダウンロードURLをチーム内の誰でも取得できてしまっていた(「指導者のみ」等の
-- 限定公開のお知らせでも添付だけは全員に見えてしまう抜け道になっていた)。
-- notices_select(0058)と同じaudience判定をnotice_attachmentsのテーブル・ストレージ両方に適用する。

drop policy if exists notice_attachments_select on public.notice_attachments;
create policy notice_attachments_select on public.notice_attachments for select
  using (
    exists (
      select 1 from public.notices n
      where n.id = notice_id
        and n.team_id = public.current_team_id()
        and (
          public.current_role() in ('指導者', '管理者')
          or n.audience = '全員'
          or (n.audience = '運営以上' and public.current_role() = '運営')
          or (
            n.audience = '学年指定'
            and exists (
              select 1
              from public.player_guardians pg
              join public.players p on p.id = pg.player_id
              where pg.profile_id = auth.uid()
                and p.status = '在籍'
                and p.grade is not null
                and n.target_grade_min is not null
                and p.grade::int >= n.target_grade_min::int
            )
          )
        )
    )
  );

drop policy if exists notice_attachments_storage_select on storage.objects;
create policy notice_attachments_storage_select on storage.objects for select
  using (
    bucket_id = 'notice-attachments'
    and (storage.foldername(name))[1] = public.current_team_id()::text
    and exists (
      select 1 from public.notices n
      where n.id = ((storage.foldername(name))[2])::uuid
        and n.team_id = public.current_team_id()
        and (
          public.current_role() in ('指導者', '管理者')
          or n.audience = '全員'
          or (n.audience = '運営以上' and public.current_role() = '運営')
          or (
            n.audience = '学年指定'
            and exists (
              select 1
              from public.player_guardians pg
              join public.players p on p.id = pg.player_id
              where pg.profile_id = auth.uid()
                and p.status = '在籍'
                and p.grade is not null
                and n.target_grade_min is not null
                and p.grade::int >= n.target_grade_min::int
            )
          )
        )
    )
  );
