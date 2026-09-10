-- RLS越境テストの土台(B-2)。`supabase test db`(pgTAP)でCI上のみ実行される
-- (Docker必須のため、このリポジトリのローカル開発環境では通常実行しない)。
--
-- 2チーム・2ユーザー(それぞれ管理者)を作り、current_team_id()/current_role()の
-- 導出元であるactive_team_sessions/team_membershipsを直接組み立てた上で、
-- 一方のチームの管理者として、もう一方のチームの行(選手・お知らせ)が
-- 一切見えないことを確認する。同じ仕組み(tests.authenticate_as)を使えば、
-- 他のteam_id列を持つテーブルにも同様のテストを追加できる。

begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

create schema if not exists tests;

-- request.jwt.claims(sub・session_id)とPostgresのroleを、指定ユーザー・セッションで
-- 認証済みのRoute Handler/PostgRESTリクエストと同じ状態にする。is_local=trueなので
-- このトランザクション(このテストファイル全体)の間だけ有効。
create or replace function tests.authenticate_as(p_user_id uuid, p_session_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id::text, 'session_id', p_session_id::text, 'role', 'authenticated')::text,
    true
  );
  perform set_config('role', 'authenticated', true);
end;
$$;

-- テストデータ投入(postgresロールのまま、RLSを経由せず直接insertする)。
do $$
declare
  team_a uuid := gen_random_uuid();
  team_b uuid := gen_random_uuid();
  alice uuid := gen_random_uuid();
  bob uuid := gen_random_uuid();
  session_a uuid := gen_random_uuid();
  session_b uuid := gen_random_uuid();
begin
  insert into public.teams (id, name) values (team_a, 'RLS Test Team A'), (team_b, 'RLS Test Team B');

  insert into auth.users (id, email) values (alice, 'rls-test-alice@example.test'), (bob, 'rls-test-bob@example.test');

  insert into public.profiles (id, team_id, name, role) values
    (alice, team_a, 'Alice', '管理者'),
    (bob, team_b, 'Bob', '管理者');

  insert into public.team_memberships (user_id, team_id, role) values
    (alice, team_a, '管理者'),
    (bob, team_b, '管理者');

  insert into public.active_team_sessions (session_id, user_id, team_id) values
    (session_a, alice, team_a),
    (session_b, bob, team_b);

  insert into public.players (team_id, sei, mei) values (team_a, 'エー', 'チーム'), (team_b, 'ビー', 'チーム');

  insert into public.notices (team_id, title, sender_id) values
    (team_a, 'Team Aのお知らせ', alice),
    (team_b, 'Team Bのお知らせ', bob);

  perform set_config('tests.team_a', team_a::text, true);
  perform set_config('tests.team_b', team_b::text, true);
  perform set_config('tests.alice', alice::text, true);
  perform set_config('tests.bob', bob::text, true);
  perform set_config('tests.session_a', session_a::text, true);
  perform set_config('tests.session_b', session_b::text, true);
end $$;

-- Team Aの管理者として認証
select tests.authenticate_as(current_setting('tests.alice')::uuid, current_setting('tests.session_a')::uuid);

select is(
  (select count(*) from public.players)::int,
  1,
  'Team Aの管理者にはselect(*)で1件(自チーム分)の選手しか見えない'
);
select is(
  (select team_id from public.players limit 1),
  current_setting('tests.team_a')::uuid,
  'Team Aの管理者に見える選手のteam_idはTeam A'
);
select is(
  (select count(*) from public.notices)::int,
  1,
  'Team Aの管理者にはお知らせも自チーム分1件しか見えない(Team Bのお知らせは越境しない)'
);

-- Team Bの管理者として認証しなおし、逆方向も確認
select tests.authenticate_as(current_setting('tests.bob')::uuid, current_setting('tests.session_b')::uuid);

select is(
  (select count(*) from public.players)::int,
  1,
  'Team Bの管理者にはselect(*)で1件(自チーム分)の選手しか見えない'
);
select is(
  (select team_id from public.players limit 1),
  current_setting('tests.team_b')::uuid,
  'Team Bの管理者に見える選手のteam_idはTeam B'
);
select is(
  (select count(*) from public.notices)::int,
  1,
  'Team Bの管理者にはお知らせも自チーム分1件しか見えない(Team Aのお知らせは越境しない)'
);

select * from finish();

rollback;
