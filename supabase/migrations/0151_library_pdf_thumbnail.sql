begin;

-- ライブラリの資料詳細ページでもPDFをサムネイル表示できるようにする
-- (お知らせ添付の0132と同じパターン)。サムネイルは元ファイルと同じ
-- Storageバケット/フォルダ構成({team_id}/{item_id}/...)に保存するため、
-- library_files_storage_select/_insert(0072、フォルダ単位のteam_idチェックのみ)は
-- 変更不要でそのまま利用できる。

alter table public.library_files
  add column thumbnail_path text;

-- library_files_storage_delete(0147)はstorage_pathの完全一致でしかアップロード者を
-- 判定できないため、このままだとサムネイルオブジェクト(storage_pathとは別名)を
-- 削除できない。thumbnail_pathとの一致でも許可するよう条件を広げる。
drop policy library_files_storage_delete on storage.objects;
create policy library_files_storage_delete on storage.objects for delete
  using (
    bucket_id = 'library-files'
    and (storage.foldername(name))[1] = public.current_team_id()::text
    and exists (
      select 1 from public.library_files f
      join public.library_items i on i.id = f.library_item_id
      where (f.storage_path = storage.objects.name or f.thumbnail_path = storage.objects.name)
        and (i.uploader_id = auth.uid() or public.current_role() in ('指導者', '管理者'))
    )
  );

commit;
