begin;

-- 複数チーム所属基盤 段階3d-1c-2: legacy trigger/functionの撤去。
-- trg_protect_last_admin/protect_last_admin()(0001、profiles.role基準の
-- 最後の管理者保護)は、3d-1b以降update_team_member()がprofiles.roleを
-- 更新しなくなったことでprofiles.roleとteam_memberships.roleが乖離し、
-- 陳腐化したデータに基づいて動作するようになっていた。
--
-- 最後の管理者保護の実効的な役割は、既にteam_memberships基準の
-- trg_protect_last_team_admin(0114)が担っており、profiles直接操作経由でも
-- sync_profile_to_team_membership()のAFTERトリガーを介して最終的にこちらで
-- 保護されることをローカル実測で確認済み(3d-1c-2設計調査time)。
--
-- profiles_update_by_admin/profiles_delete_by_admin(3d-1cで既にDROP済み)・
-- trg_protect_last_team_admin・その他のtrigger/functionには一切触れない。

drop trigger trg_protect_last_admin on public.profiles;
drop function public.protect_last_admin();

commit;
