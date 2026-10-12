begin;

-- ライブラリの資料ごとに閲覧できるロールを制限できるようにする。
-- デフォルトは全ロール(現状維持=誰でも閲覧可)で、アップロード時・編集時に
-- 絞り込みを選んだ場合のみ制限がかかる(polls.allowed_rolesと同じ考え方)。
-- pollsと異なり、閲覧そのものがselectなので、安全な代替のアクションゲートが
-- 存在しない。そのためlibrary_items_select/library_files_selectのRLS自体に
-- ロール判定を追加する。
alter table public.library_items
  add column allowed_roles text[] not null default array['一般', '運営', '指導者', '管理者'];

drop policy library_items_select on public.library_items;
create policy library_items_select on public.library_items for select
  using (
    team_id = public.current_team_id()
    and public.current_role() = any(allowed_roles)
  );

drop policy library_files_select on public.library_files;
create policy library_files_select on public.library_files for select
  using (
    exists (
      select 1 from public.library_items i
      where i.id = library_item_id
        and i.team_id = public.current_team_id()
        and public.current_role() = any(i.allowed_roles)
    )
  );

commit;
