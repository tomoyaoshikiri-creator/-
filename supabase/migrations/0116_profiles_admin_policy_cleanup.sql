begin;

-- 複数チーム所属基盤 段階3d-1c: legacy policyのDROP。
-- 3d-1bで、管理者による他メンバーのrole/status変更はupdate_team_member() RPCへ、
-- メンバー削除はremove_team_member() RPCへ完全移行済み。profiles_update_by_admin/
-- profiles_delete_by_adminは、app経由での利用者が現在0件であることを確認済み
-- (.from("profiles").update/delete の呼び出し元を全数確認、対象なし)。
--
-- profiles_select(0114版)・profiles_update_self(0010)・関連トリガー
-- (trg_protect_last_admin/trg_protect_profile_self_update/
-- trg_sync_profile_to_team_membership)には一切触れない。
--
-- trg_protect_last_admin/protect_last_admin()(0001、profiles.role基準の
-- 最後の管理者保護)がteam_memberships基準へ完全移行しておらず陳腐化している
-- 問題を別途発見しているが、これは本migrationの対象外とし、独立した段階
-- (3d-1c-2)として改めて設計・検証する。

drop policy profiles_update_by_admin on public.profiles;
drop policy profiles_delete_by_admin on public.profiles;

commit;
