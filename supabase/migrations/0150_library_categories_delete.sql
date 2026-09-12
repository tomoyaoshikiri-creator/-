begin;

-- ライブラリのカテゴリー削除を可能にする。0149で追加したリネーム(update)権限と
-- 同じくスタッフ(指導者・管理者)のみに限定する(誰でも削除できると、他メンバーが
-- 分類済みの資料の分類が意図せず失われるため)。
-- library_items.category_idはon delete set nullのため(0073)、削除されたカテゴリーに
-- 属していた資料は自動的に「カテゴリーなし」になる(追加のハンドリング不要)。

create policy library_categories_delete on public.library_categories for delete
  using (
    team_id = public.current_team_id()
    and public.current_role() in ('指導者', '管理者')
  );

commit;
