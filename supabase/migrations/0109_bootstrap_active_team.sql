begin;

-- 複数チーム所属基盤 段階3a-2: Bootstrap経路の追加。
-- (1) switch_active_team()からstatus='アクティブ'条件を削除
--     (statusはアクセス制御に使わない方針の確定に伴う修正。0108の内容を修正する)
-- (2) initialize_active_team()新設: auth.uid()/session_idだけを起点に、
--     current_team_id()/profiles.team_idに一切依存せずactive teamを解決する。
-- (3) list_my_team_memberships()新設: 本人の所属一覧を取得する読み取り専用RPC
--     (チーム選択UI用、段階3dで使用開始)。
-- 既存のprofiles.team_id/role/status・current_team_id()/current_role()・
-- protect_last_admin・protect_profile_self_update・create_team_and_admin・
-- accept_invite・既存RLS/Storage policy・0107同期トリガー・API Route・UIは
-- 一切変更しない。3関数ともまだアプリからは呼ばれない。

-- (1) switch_active_team(): status条件を削除
create or replace function public.switch_active_team(target_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_affected_rows int;
begin
  if auth.uid() is null then
    raise exception '認証されていません。';
  end if;

  if not exists (
    select 1 from public.team_memberships
    where user_id = auth.uid()
      and team_id = target_team_id
  ) then
    raise exception '指定されたチームへの所属が確認できません。';
  end if;

  v_session_id := case
    when auth.jwt() ->> 'session_id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then (auth.jwt() ->> 'session_id')::uuid
    else null
  end;

  if v_session_id is null then
    raise exception 'セッション情報(session_id)を取得できませんでした。';
  end if;

  insert into public.active_team_sessions (session_id, user_id, team_id, updated_at)
  values (v_session_id, auth.uid(), target_team_id, now())
  on conflict (session_id) do update
    set team_id = excluded.team_id,
        updated_at = now()
    where public.active_team_sessions.user_id = excluded.user_id;

  get diagnostics v_affected_rows = row_count;

  if v_affected_rows <> 1 then
    raise exception 'セッション情報の整合性を確認できません。';
  end if;

  update public.profiles set last_team_id = target_team_id where id = auth.uid();
end;
$$;

revoke all on function public.switch_active_team(uuid) from public;
grant execute on function public.switch_active_team(uuid) to authenticated;

-- (2) initialize_active_team(): Bootstrap本体
create or replace function public.initialize_active_team()
returns table(status text, team_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_existing_owner uuid;
  v_existing_team_id uuid;
  v_membership_count int;
  v_single_team_id uuid;
  v_last_team_id uuid;
begin
  if auth.uid() is null then
    raise exception '認証されていません。';
  end if;

  v_session_id := case
    when auth.jwt() ->> 'session_id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then (auth.jwt() ->> 'session_id')::uuid
    else null
  end;

  if v_session_id is null then
    raise exception 'セッション情報(session_id)を取得できませんでした。';
  end if;

  -- session_idの既存行を確認する。
  -- A) 行が存在しない → v_existing_owner は null のまま(新規sessionとして継続)
  -- B) 行が存在し、user_id = auth.uid() → 所有者一致、対応membershipを確認
  -- C) 行が存在し、user_id <> auth.uid() → 所有者不整合、即座に例外
  select ats.user_id, ats.team_id
    into v_existing_owner, v_existing_team_id
  from public.active_team_sessions ats
  where ats.session_id = v_session_id;

  if v_existing_owner is not null and v_existing_owner is distinct from auth.uid() then
    raise exception 'セッション情報の整合性を確認できません。';
  end if;

  if v_existing_owner is not null then
    -- 所有者は一致している。対応するmembershipが今も有効か確認する
    -- (最優先: 既にこのsessionにactive teamがあれば、他の判定は一切行わずそれを採用する)。
    -- (tm.team_idのように明示的にエイリアス修飾する。RETURNS TABLE(..., team_id uuid)
    --  により関数本体全体でteam_idという名前が出力変数としても解釈されるため、
    --  修飾しない場合はテーブル列か変数か曖昧になりエラーになる)
    if exists (
      select 1 from public.team_memberships tm
      where tm.user_id = auth.uid() and tm.team_id = v_existing_team_id
    ) then
      return query select 'resolved'::text, v_existing_team_id;
      return;
    end if;
    -- membershipが既に存在しない(脱退済み等)。古いactive teamは採用せず、
    -- 以下の再初期化ロジックへフォールスルーする
    -- (この行自体を削除する処理はここでは行わない。有効な再初期化が決まれば
    --  switch_active_team()のUPSERTにより同じsession_idの内容が更新される)。
  end if;

  select count(*) into v_membership_count
  from public.team_memberships
  where user_id = auth.uid();

  if v_membership_count = 0 then
    return query select 'no_membership'::text, null::uuid;
    return;
  end if;

  if v_membership_count = 1 then
    select tm.team_id into v_single_team_id
    from public.team_memberships tm
    where tm.user_id = auth.uid();

    perform public.switch_active_team(v_single_team_id);
    return query select 'resolved'::text, v_single_team_id;
    return;
  end if;

  -- 複数件: last_team_idはあくまで新規sessionの初期値ヒント
  select p.last_team_id into v_last_team_id
  from public.profiles p
  where p.id = auth.uid();

  if v_last_team_id is not null and exists (
    select 1 from public.team_memberships tm
    where tm.user_id = auth.uid() and tm.team_id = v_last_team_id
  ) then
    perform public.switch_active_team(v_last_team_id);
    return query select 'resolved'::text, v_last_team_id;
    return;
  end if;

  return query select 'needs_selection'::text, null::uuid;
end;
$$;

revoke all on function public.initialize_active_team() from public;
grant execute on function public.initialize_active_team() to authenticated;

-- (3) list_my_team_memberships(): チーム選択UI用、読み取り専用
create or replace function public.list_my_team_memberships()
returns table(team_id uuid, team_name text, role text, status text)
language sql
security definer
set search_path = public
as $$
  select tm.team_id, t.name, tm.role, tm.status
  from public.team_memberships tm
  join public.teams t on t.id = tm.team_id
  where tm.user_id = auth.uid()
$$;

revoke all on function public.list_my_team_memberships() from public;
grant execute on function public.list_my_team_memberships() to authenticated;

commit;
