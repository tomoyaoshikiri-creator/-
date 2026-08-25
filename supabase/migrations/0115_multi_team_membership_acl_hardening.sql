begin;

-- ACL修正(0114適用後のドリフト解消 + protect_last_team_admin最小権限化)。
-- 関数本体・profiles_select・list_team_members・trigger定義は一切変更しない。
-- postgres/service_roleへのEXECUTEには触れない。新規GRANTは行わない
-- (0114で付与済みのauthenticated向け3 RPC GRANTをそのまま維持する)。
--
-- is_current_team_member/update_team_member/remove_team_memberの
-- PUBLIC/anon EXECUTEは、本番では本migration適用前に個別の手動対応で
-- 既にREVOKE済みであることを事前確認済み(pre-0115本番baseline)。
-- 以下のREVOKE文は本番に対しては実質no-opだが、migration履歴として
-- 正式に記録し、新規環境への適用でも同じ状態を再現するために含める。

revoke execute on function public.is_current_team_member(uuid) from public;
revoke execute on function public.is_current_team_member(uuid) from anon;

revoke execute on function public.update_team_member(uuid, text, text) from public;
revoke execute on function public.update_team_member(uuid, text, text) from anon;

revoke execute on function public.remove_team_member(uuid) from public;
revoke execute on function public.remove_team_member(uuid) from anon;

-- protect_last_team_admin()はtrigger関数(RETURNS trigger)。トリガー発火に
-- EXECUTE権限は不要であり、RETURNS trigger型はSQLから直接呼び出すこと自体が
-- PostgreSQL仕様上不可能であることをローカルの隔離テストで実測確認済み。
-- authenticatedへのGRANTは不要。postgres/service_roleのEXECUTEは変更しない。
revoke execute on function public.protect_last_team_admin() from public;
revoke execute on function public.protect_last_team_admin() from anon;
revoke execute on function public.protect_last_team_admin() from authenticated;

commit;
