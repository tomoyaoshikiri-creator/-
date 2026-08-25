begin;

-- 複数チーム所属基盤 段階3d-1a(DB expand)。
-- 目的: 2件目のmembershipを実際に作れるようにする前に、アプリ内部の
-- 「現在チーム/現在権限」の判定をprofiles legacy情報(profiles.team_id/role/status)
-- から完全に切り離す。本migrationは追加のみで構成し、既存のprofiles.team_id基準の
-- アプリコード(users/page.tsx等)を一切壊さない設計とする(現在は全ユーザーが
-- 1membershipのみのため、旧定義と新定義は現在のデータに対して常に同じ結果を返す)。
--
-- 段階3d-1b(アプリコード切替)・3d-1c(profiles_update_by_admin/profiles_delete_by_admin
-- のDROP等のlegacy cleanup)は本migrationに含めない。

-- ============================================================
-- 1. is_current_team_member(p_profile_id uuid)
--    「p_profile_idのユーザーが、現在のcurrent_team_id()に対応する
--    team_membershipsを持っているか」だけを判定する最小関数。
--    team_membershipsはRLS有効・policy0件のため、authenticatedロールから
--    直接参照できない。current_team_id()/current_role()と同じくSECURITY DEFINERで
--    RLSをbypassする。profiles.team_idは参照しない。statusは条件に使用しない。
-- ============================================================
create or replace function public.is_current_team_member(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_memberships tm
    where tm.user_id = p_profile_id
      and tm.team_id = public.current_team_id()
  )
$$;

revoke execute on function public.is_current_team_member(uuid) from public;
grant execute on function public.is_current_team_member(uuid) to authenticated;

-- ============================================================
-- 2. profiles_select再定義。
--    profiles.team_id = current_team_id() ではなく、team_membershipsを
--    所属正本とするis_current_team_member(profiles.id)基準へ変更する。
--    TO authenticatedを明示する(PUBLIC/anonのままだと、is_current_team_member()の
--    EXECUTE権限がauthenticated限定のため、anonがprofilesを読もうとした際に
--    「0件」ではなく「permission denied」エラーになることをローカルで実測確認済み。
--    policy自体をTO authenticatedに限定すればanonにはpolicyが適用されず、
--    従来通り静かに0件になることも実測確認済み)。
-- ============================================================
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  to authenticated
  using (public.is_current_team_member(profiles.id));

-- ============================================================
-- 3. list_team_members()再定義。
--    profiles.team_id = current_team_id() ではなく、team_membershipsを
--    所属・role・statusの正本とする。戻り値の型・列名・列順は変更しない
--    (TeamMember型はlist_team_membersのReturnsから自動導出されているため、
--    アプリコード側の変更を一切不要にする)。created_at列の値はprofiles.created_at
--    (アカウント作成日時)からtm.joined_at(このチームへの参加日時)へ変更する。
--    この列はusers/page.tsxのUI上どこにも表示・使用されていないことを確認済み。
-- ============================================================
create or replace function public.list_team_members()
returns table(id uuid, name text, role text, status text, email text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.name,
    tm.role,
    tm.status,
    case when public.current_role() = '管理者' then p.email else null end,
    tm.joined_at
  from public.team_memberships tm
  join public.profiles p on p.id = tm.user_id
  where tm.team_id = public.current_team_id()
  order by tm.joined_at asc
$$;

revoke execute on function public.list_team_members() from public;
grant execute on function public.list_team_members() to authenticated;

-- ============================================================
-- 4. protect_last_team_admin(): team_memberships版「最後の管理者保護」。
--    profiles用の既存protect_last_adminとは別物として新設し、既存トリガーは
--    変更しない。team_id単位のadvisory lockで同時実行を直列化する
--    (pg_advisory_xact_lockはトランザクション終了時に自動解放される)。
--    team_id/user_idの変更(UPDATE)は用途がなく、想定外の抜け道になり得るため
--    明示的に拒否する(sync_profile_to_team_membershipがprofiles.team_id変更を
--    拒否するのと同じ設計判断)。INSERTは管理者数を減らさないため対象外
--    (既存profiles版protect_last_adminもBEFORE DELETE OR UPDATEのみ)。
-- ============================================================
create or replace function public.protect_last_team_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(
    ('x' || substr(md5(coalesce(new.team_id, old.team_id)::text), 1, 16))::bit(64)::bigint
  );

  if tg_op = 'DELETE' then
    if old.role = '管理者'
       and (select count(*) from public.team_memberships where team_id = old.team_id and role = '管理者') <= 1 then
      raise exception '管理者は最低1名必要です。';
    end if;
    return old;
  end if;

  if new.team_id is distinct from old.team_id or new.user_id is distinct from old.user_id then
    raise exception 'team_memberships.team_id/user_idの変更は許可されていません。';
  end if;

  if old.role = '管理者' and new.role <> '管理者' then
    if (select count(*) from public.team_memberships where team_id = old.team_id and role = '管理者') <= 1 then
      raise exception '管理者は最低1名必要です。';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_last_team_admin on public.team_memberships;
create trigger trg_protect_last_team_admin
  before update or delete on public.team_memberships
  for each row execute function public.protect_last_team_admin();

-- ============================================================
-- 5. update_team_member(): 現在チームのメンバーのrole/statusを変更するRPC。
--    profiles.nameは変更しない(グローバル属性、本人のみsettings/name経由で変更可能
--    という方針のため)。current_role()のNULLチェックはIS DISTINCT FROMで行い、
--    0110と同型のNULL素通りを避ける。role/statusの許可値はteam_membershipsの
--    既存CHECK制約でも保護されるが、エラーメッセージの質のためRPC内でも検証する。
--    最後の管理者保護はこの関数では判定せず、trg_protect_last_team_adminトリガーに
--    一任する(判定ロジックの重複を避ける)。
-- ============================================================
create or replace function public.update_team_member(
  target_user_id uuid,
  new_role text default null,
  new_status text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '認証されていません。';
  end if;
  if public.current_team_id() is null then
    raise exception 'セッション情報を取得できませんでした。';
  end if;
  if public.current_role() is distinct from '管理者' then
    raise exception '権限がありません';
  end if;
  if target_user_id is null then
    raise exception '対象を指定してください';
  end if;
  if not exists (
    select 1 from public.team_memberships
    where user_id = target_user_id and team_id = public.current_team_id()
  ) then
    raise exception '対象のメンバーが見つかりません';
  end if;
  if new_role is not null and new_role not in ('一般', '運営', '指導者', '管理者') then
    raise exception '不正なroleです: %', new_role;
  end if;
  if new_status is not null and new_status not in ('アクティブ', '休止') then
    raise exception '不正なstatusです: %', new_status;
  end if;

  update public.team_memberships
    set role = coalesce(new_role, role),
        status = coalesce(new_status, status)
    where user_id = target_user_id and team_id = public.current_team_id();
end;
$$;

revoke execute on function public.update_team_member(uuid, text, text) from public;
grant execute on function public.update_team_member(uuid, text, text) to authenticated;

-- ============================================================
-- 6. remove_team_member(): 現在チームのmembershipだけを削除するRPC。
--    「チームから外す」と「CIRCLE LINES上のアカウント自体を削除する」を
--    完全に別の操作として扱う方針のため、auth.users/profiles/他チームの
--    team_membershipsには一切触れない。対象の(user_id, current_team_id())の
--    active_team_sessionsも同時に削除し、ats_mismatchを残さない
--    (current_team_id()のJOIN構造上、削除しなくても該当sessionは自動的に
--    NULLへ解決されるため必須ではないが、ハイジーン目的で実施する)。
--    最後の管理者保護はtrg_protect_last_team_adminトリガーに一任する。
-- ============================================================
create or replace function public.remove_team_member(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '認証されていません。';
  end if;
  if public.current_team_id() is null then
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
    where user_id = target_user_id and team_id = public.current_team_id()
  ) then
    raise exception '対象のメンバーが見つかりません';
  end if;

  delete from public.team_memberships
    where user_id = target_user_id and team_id = public.current_team_id();

  delete from public.active_team_sessions
    where user_id = target_user_id and team_id = public.current_team_id();
end;
$$;

revoke execute on function public.remove_team_member(uuid) from public;
grant execute on function public.remove_team_member(uuid) to authenticated;

commit;
