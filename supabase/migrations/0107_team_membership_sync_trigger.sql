begin;

-- 複数チーム所属基盤 段階2: profiles → team_memberships の一時同期トリガー。
-- 目的: 複数チーム所属UIを使い始める段階3までの間、profilesへの書き込みを
-- team_membershipsへ自動反映し、両者を常に一致させ続ける(段階3で本格的に
-- 複数チーム対応するまでの橋渡し)。この期間、create_team_and_admin/accept_invite
-- 側の「既に1チームに所属している場合はエラー」という既存ガードは維持したまま
-- 変更しない。これにより1ユーザーが複数のteam_membershipsを持つことは構造的に
-- 発生しない(段階3dで両RPCを複数チーム対応に書き換えるのと同じmigrationで、
-- このトリガー自体も削除する)。
--
-- 対象: profilesのINSERT、およびrole/status/team_idのUPDATEのみ。
-- profilesのDELETEは同期しない(team_memberships.user_idのON DELETE CASCADEに委任)。
-- profiles.team_id/role/status・current_team_id()/current_role()・protect_last_admin・
-- protect_profile_self_update・create_team_and_admin・accept_invite・既存RLS/
-- Storage policy・API Route・UIは一切変更しない。

-- 0) 段階1のbackfill後、段階2適用までの間に新規作成・変更された可能性のある
--    profilesをteam_membershipsに追いつかせる。
insert into public.team_memberships (user_id, team_id, role, status, joined_at)
select id, team_id, role, status, created_at
from public.profiles p
where not exists (
  select 1 from public.team_memberships tm
  where tm.user_id = p.id and tm.team_id = p.team_id
)
on conflict (user_id, team_id) do nothing;

update public.team_memberships tm
set role = p.role, status = p.status
from public.profiles p
where tm.user_id = p.id and tm.team_id = p.team_id
  and (tm.role <> p.role or tm.status <> p.status);

-- 1) 追いつかせた後の整合性をfail closedで確認する。
do $$
declare
  v_profiles_count int;
  v_team_memberships_count int;
  v_missing int;
  v_mismatched int;
  v_duplicate int;
  v_extra_memberships int;
begin
  select count(*) into v_profiles_count from public.profiles;
  select count(*) into v_team_memberships_count from public.team_memberships;

  select count(*) into v_missing
  from public.profiles p
  where not exists (
    select 1 from public.team_memberships tm
    where tm.user_id = p.id and tm.team_id = p.team_id
  );

  select count(*) into v_mismatched
  from public.profiles p
  join public.team_memberships tm on tm.user_id = p.id and tm.team_id = p.team_id
  where tm.role <> p.role or tm.status <> p.status;

  select count(*) into v_duplicate
  from (
    select user_id, team_id from public.team_memberships
    group by user_id, team_id having count(*) > 1
  ) d;

  -- 現在のprofiles.id/team_idに対応しない余剰team_memberships行(0であること)。
  select count(*) into v_extra_memberships
  from public.team_memberships tm
  where not exists (
    select 1
    from public.profiles p
    where p.id = tm.user_id
      and p.team_id = tm.team_id
  );

  if v_profiles_count <> v_team_memberships_count
     or v_missing > 0 or v_mismatched > 0 or v_duplicate > 0 or v_extra_memberships > 0 then
    raise exception
      '同期後もprofilesとteam_membershipsの整合性が取れていないためmigrationを中止します: profiles_count=%, team_memberships_count=%, missing=%, mismatched=%, duplicate=%, extra_memberships=%',
      v_profiles_count, v_team_memberships_count, v_missing, v_mismatched, v_duplicate, v_extra_memberships;
  end if;
end $$;

-- 2) 同期トリガー本体。
--    SECURITY DEFINERとするのは、team_membershipsがRLS有効・policy0件(段階1で
--    意図的にそう設計した)であり、authenticated/anonからの直接書き込みが常に
--    拒否されるため。trg_protect_last_admin/trg_protect_profile_self_update
--    (いずれもBEFORE)はprofiles自身の列を検証・拒否するだけでNEWの内容を
--    書き換えることはなく、このトリガーをAFTERにすることで、それら2つの
--    BEFOREトリガーが例外を投げずに完了した(=変更が確定した)後の最終的な
--    NEWの値だけを同期対象にできる。異常時は2つのBEFOREトリガーが先に例外を
--    投げ、トランザクション全体がロールバックされるため、このAFTERトリガー
--    自体は実行されない。
--    current_team_id()/current_role()/auth.uid()はいずれも参照しない
--    (NEW/OLDの行の値だけで完結するため、実行コンテキストに依存しない)。
--    正常な既存操作では従来と同じ結果になるが、team_memberships側への
--    同期INSERT/UPDATEがFK/CHECK制約等の理由で万一失敗した場合は、
--    データ不整合を残さないためprofiles側の操作も同一トランザクションごと
--    失敗する(意図したfail closed挙動)。
create or replace function public.sync_profile_to_team_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.team_id is distinct from old.team_id then
      raise exception 'profiles.team_idの変更は段階2の同期対象外です(現行のRLSでも更新できないはずです)';
    end if;
  end if;

  insert into public.team_memberships (user_id, team_id, role, status, joined_at)
  values (new.id, new.team_id, new.role, new.status, new.created_at)
  on conflict (user_id, team_id) do update
    set role = excluded.role,
        status = excluded.status;

  return new;
end;
$$;

drop trigger if exists trg_sync_profile_to_team_membership on public.profiles;
create trigger trg_sync_profile_to_team_membership
  after insert or update of role, status, team_id on public.profiles
  for each row execute function public.sync_profile_to_team_membership();

commit;
