begin;

-- 複数チーム所属基盤 追加修正 Step X-2。
-- 目的: 旧単一チーム構造の残骸である public.profiles.team_id を完全に廃止し、
-- 所属の正本を team_memberships、現在選択中チームを active_team_sessions /
-- current_team_id() とする構造を完成させる。
--
-- 処理順序(この順序を守ることが安全性の前提):
--   0. fail-closed事前確認(想定したスキーマ状態でなければ即座に中断)
--   1. create_team_and_admin() / accept_invite() を、team_membershipsへ
--      直接INSERTする新構造へ再定義(trg_sync_profile_to_team_membershipに
--      依存しない形にする)。両関数とも新規プロフィール作成時のjoined_atは、
--      作成したprofiles.created_atの値をRETURNINGで取得しそのまま使う
--      (sync_profile_to_team_membership()のnew.created_at相当を明示的に再現し、
--      二重にnow()を評価しない)。PL/pgSQL関数本体はCREATE OR REPLACE時点では
--      スキーマ検証されないため、この時点ではまだprofiles.team_idは
--      存在したままでよい。has_profile=true分岐・sport/category検証・
--      招待有効期限チェック・player_guardians紐付け等、それ以外のロジックは
--      一切変更しない。
--   2. trg_sync_profile_to_team_membership / sync_profile_to_team_membership()
--      を明示的にDROP(CASCADEに頼らない)。
--   3. protect_profile_self_update()から profiles.team_id 依存部分のみ除去。
--      role/status変更のガードは維持する。
--   4. profiles_team_id_fkey(FK) / profiles_team_id_idx(index) / team_id(列)
--      を明示的にDROP(CASCADEに頼らない)。
--
-- 対象データ(team_memberships/active_team_sessions/PHASE3_TEST/STEP3A_TEST等)
-- には一切触れない。DDLと関数再定義のみで構成する。

-- ============================================================
-- 0. fail-closed事前確認。想定したスキーマ状態と異なる場合は即座に例外を
--    発生させ、migration全体をロールバックする。
-- ============================================================
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'team_id'
      and data_type = 'uuid' and is_nullable = 'NO'
  ) then
    raise exception 'fail-closed: profiles.team_idが想定した型(uuid)/NOT NULL制約と一致しません。';
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'profiles'
      and constraint_name = 'profiles_team_id_fkey' and constraint_type = 'FOREIGN KEY'
  ) then
    raise exception 'fail-closed: profiles_team_id_fkeyが見つかりません。';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'profiles' and indexname = 'profiles_team_id_idx'
  ) then
    raise exception 'fail-closed: profiles_team_id_idxが見つかりません。';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_sync_profile_to_team_membership'
      and tgrelid = 'public.profiles'::regclass and not tgisinternal
  ) then
    raise exception 'fail-closed: trg_sync_profile_to_team_membershipが見つかりません。';
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
    where tc.table_schema = 'public' and tc.table_name = 'team_memberships'
      and tc.constraint_type = 'UNIQUE'
    group by tc.constraint_name
    having array_agg(kcu.column_name::text order by kcu.ordinal_position) = array['user_id','team_id']::text[]
  ) then
    raise exception 'fail-closed: team_memberships.UNIQUE(user_id, team_id)が見つかりません。';
  end if;
end $$;

-- ============================================================
-- 1. create_team_and_admin() / accept_invite() 再定義。
--    has_profile = false分岐のみ変更、それ以外は0118と完全に同一。
-- ============================================================
create or replace function public.create_team_and_admin(
  team_name text, admin_name text, team_sport text default 'ミニバスケットボール',
  team_category text default '小学生'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_team_id uuid;
  has_profile boolean;
  v_profile_created_at timestamptz;
begin
  if auth.uid() is null then
    raise exception '認証が必要です';
  end if;
  if team_sport not in (
    'バスケットボール', 'ミニバスケットボール', 'サッカー', 'フットサル',
    '野球', 'ハンドボール', 'ラグビー', 'バレーボール'
  ) then
    raise exception 'invalid sport: %', team_sport;
  end if;
  if team_category not in ('小学生', '中学生', '高校生', '大学生', 'その他') then
    raise exception 'invalid category: %', team_category;
  end if;
  if team_category <> '小学生' and team_sport = 'ミニバスケットボール' then
    raise exception 'ミニバスケットボールは小学生カテゴリーでのみ選択できます';
  end if;

  select exists(select 1 from public.profiles where id = auth.uid()) into has_profile;

  insert into public.teams (name, sport, category) values (team_name, team_sport, team_category) returning id into new_team_id;

  if has_profile then
    insert into public.team_memberships (user_id, team_id, role, status)
      values (auth.uid(), new_team_id, '管理者', 'アクティブ');
  else
    insert into public.profiles (id, name, role, status)
      values (auth.uid(), admin_name, '管理者', 'アクティブ')
      returning created_at into v_profile_created_at;
    insert into public.team_memberships (user_id, team_id, role, status, joined_at)
      values (auth.uid(), new_team_id, '管理者', 'アクティブ', v_profile_created_at);
  end if;

  return new_team_id;
end;
$$;

create or replace function public.accept_invite(invite_token text, member_name text, player_ids uuid[] default '{}')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
  member_email text;
  has_profile boolean;
  v_profile_created_at timestamptz;
begin
  if auth.uid() is null then
    raise exception '認証が必要です';
  end if;

  select * into inv from public.invites
    where token = invite_token and expires_at > now()
    for update;
  if not found then
    raise exception '招待リンクが無効か、有効期限が切れています';
  end if;

  select exists(select 1 from public.profiles where id = auth.uid()) into has_profile;

  if has_profile then
    if exists(select 1 from public.team_memberships where user_id = auth.uid() and team_id = inv.team_id) then
      raise exception '既にこのチームのメンバーです';
    end if;
    insert into public.team_memberships (user_id, team_id, role, status)
      values (auth.uid(), inv.team_id, inv.role, 'アクティブ');
  else
    select email into member_email from auth.users where id = auth.uid();
    insert into public.profiles (id, name, role, status, email)
      values (auth.uid(), member_name, inv.role, 'アクティブ', member_email)
      returning created_at into v_profile_created_at;
    insert into public.team_memberships (user_id, team_id, role, status, joined_at)
      values (auth.uid(), inv.team_id, inv.role, 'アクティブ', v_profile_created_at);
  end if;

  update public.invites set used_at = now(), used_by = auth.uid() where id = inv.id;

  if inv.role = '一般' and array_length(player_ids, 1) > 0 then
    insert into public.player_guardians (team_id, player_id, profile_id)
    select inv.team_id, p.id, auth.uid()
    from public.players p
    where p.id = any(player_ids) and p.team_id = inv.team_id and p.status = '在籍'
    on conflict (player_id, profile_id) do nothing;
  end if;

  return inv.team_id;
end;
$$;

-- ============================================================
-- 2. trg_sync_profile_to_team_membership / sync_profile_to_team_membership() の廃止。
--    上記1の再定義により、profilesへの新規INSERT時にこのtriggerへ依存する
--    経路は無くなった。CASCADEに頼らず、trigger→functionの順に明示的にDROPする。
-- ============================================================
drop trigger trg_sync_profile_to_team_membership on public.profiles;
drop function public.sync_profile_to_team_membership();

-- ============================================================
-- 3. protect_profile_self_update() からprofiles.team_id依存部分のみ除去。
--    role/status変更のガードは維持する。
-- ============================================================
create or replace function public.protect_profile_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_role() is distinct from '管理者' then
    if new.role is distinct from old.role
       or new.status is distinct from old.status then
      raise exception '自分の権限・ステータスは変更できません。';
    end if;
  end if;
  return new;
end;
$$;

-- ============================================================
-- 4. profiles.team_id本体の削除(FK→index→列の順、CASCADEに頼らない)
-- ============================================================
alter table public.profiles drop constraint profiles_team_id_fkey;
drop index public.profiles_team_id_idx;
alter table public.profiles drop column team_id;

commit;
