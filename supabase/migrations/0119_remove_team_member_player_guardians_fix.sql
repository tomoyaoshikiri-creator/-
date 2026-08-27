begin;

-- 複数チーム所属基盤 追加修正 Step X-1。
-- 目的: remove_team_member()がteam_membershipsとactive_team_sessionsのみを削除し、
-- player_guardiansを削除していなかったバグの修正。
-- 対象チームから外されたユーザーの選手保護者リンク(player_guardians)が
-- team_id単位で残り続けてしまうため、対象チームのplayer_guardiansのみを
-- 明示的に削除する。他チームのplayer_guardiansには一切影響しない
-- (player_guardiansはteam_id列を持つため、team_id単位で安全にスコープできる)。
-- 本修正はremove_team_member()単体の修正であり、profiles.team_id関連の
-- 変更(Step X-2で別途対応予定)は一切含まない。

create or replace function public.remove_team_member(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_team_id uuid;
begin
  if auth.uid() is null then
    raise exception '認証されていません。';
  end if;

  v_team_id := public.current_team_id();
  if v_team_id is null then
    raise exception 'セッション情報を取得できませんでした。';
  end if;
  if public.current_role() is distinct from '管理者' then
    raise exception '権限がありません';
  end if;
  if target_user_id is null then
    raise exception '対象を指定してください';
  end if;
  if target_user_id = auth.uid() then
    raise exception '自分自身は削除できません';
  end if;
  if not exists (
    select 1 from public.team_memberships
    where user_id = target_user_id and team_id = v_team_id
  ) then
    raise exception '対象のメンバーが見つかりません';
  end if;

  delete from public.player_guardians
    where profile_id = target_user_id and team_id = v_team_id;

  delete from public.team_memberships
    where user_id = target_user_id and team_id = v_team_id;

  delete from public.active_team_sessions
    where user_id = target_user_id and team_id = v_team_id;
end;
$func$;

revoke execute on function public.remove_team_member(uuid) from public;
grant execute on function public.remove_team_member(uuid) to authenticated;

commit;
