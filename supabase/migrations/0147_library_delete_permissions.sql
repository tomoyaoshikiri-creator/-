begin;

-- ライブラリの削除権限を確定する。これまでlibrary_items/library_filesとも
-- 「チームメンバーなら誰でも削除できる」ポリシーのままで、アップロード者本人以外の
-- 一般・運営ユーザーでも他人がアップロードしたファイルを削除できてしまっていた。
-- 削除できるのを「①アップロード本人」「②指導者・管理者(スタッフ)」に限定する。
-- 閲覧・アップロード権限(全ロール)、タイトル・カテゴリーの事後編集(今回も対象外)は変更しない。

drop policy library_items_delete on public.library_items;
create policy library_items_delete on public.library_items for delete
  using (
    team_id = public.current_team_id()
    and (uploader_id = auth.uid() or public.current_role() in ('指導者', '管理者'))
  );

drop policy library_files_delete on public.library_files;
create policy library_files_delete on public.library_files for delete
  using (
    exists (
      select 1 from public.library_items i
      where i.id = library_item_id
        and i.team_id = public.current_team_id()
        and (i.uploader_id = auth.uid() or public.current_role() in ('指導者', '管理者'))
    )
  );

-- storage.objects側は、削除しようとしているファイルがlibrary_files.storage_pathと
-- 一致する行を経由してlibrary_items.uploader_idを参照する形でしか
-- アップロード者を判定できない(storage.objects自体にteam_id/uploader_idの列を持たないため)。
drop policy library_files_storage_delete on storage.objects;
create policy library_files_storage_delete on storage.objects for delete
  using (
    bucket_id = 'library-files'
    and (storage.foldername(name))[1] = public.current_team_id()::text
    and exists (
      select 1 from public.library_files f
      join public.library_items i on i.id = f.library_item_id
      where f.storage_path = storage.objects.name
        and (i.uploader_id = auth.uid() or public.current_role() in ('指導者', '管理者'))
    )
  );

commit;
