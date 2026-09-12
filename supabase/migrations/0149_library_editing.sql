begin;

-- ライブラリの資料(library_items)のタイトル・カテゴリーの事後編集と、
-- カテゴリー名(library_categories)のリネームを可能にする。0147時点では
-- 「今回も対象外」としていたが、今回改めて対応する。
--
-- library_itemsの更新権限は削除権限(0147)と同じ「①アップロード本人 ②指導者・管理者
-- (スタッフ)」に限定する。library_categoriesは特定の資料の所有物ではなくチーム全体で
-- 共有するタグであるため、誰でも新規作成できる既存のinsertポリシーとは別に、
-- 既存カテゴリーのリネームはスタッフ(指導者・管理者)のみに限定する
-- (誰でも既存カテゴリー名を書き換えられると、他のメンバーが分類済みの資料が
-- 意図せず影響を受けるため)。

create policy library_items_update on public.library_items for update
  using (
    team_id = public.current_team_id()
    and (uploader_id = auth.uid() or public.current_role() in ('指導者', '管理者'))
  )
  with check (
    team_id = public.current_team_id()
    and (uploader_id = auth.uid() or public.current_role() in ('指導者', '管理者'))
  );

create policy library_categories_update on public.library_categories for update
  using (
    team_id = public.current_team_id()
    and public.current_role() in ('指導者', '管理者')
  )
  with check (
    team_id = public.current_team_id()
    and public.current_role() in ('指導者', '管理者')
  );

commit;
