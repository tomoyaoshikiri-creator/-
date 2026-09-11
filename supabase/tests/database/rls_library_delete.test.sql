-- ライブラリの削除権限テスト(C-1)。同一チーム内の一般ロールが他人のアップロード
-- ファイルを削除できないこと、アップロード本人とスタッフ(指導者・管理者)は
-- 削除できることを確認する。tests.authenticate_as()はrls_cross_team.test.sqlと共通。

begin;

create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;

select plan(3);

create schema if not exists tests;

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
grant usage on schema tests to authenticated;
grant execute on function tests.authenticate_as(uuid, uuid) to authenticated;

do $$
declare
  team_a uuid := gen_random_uuid();
  alice uuid := gen_random_uuid();
  bob uuid := gen_random_uuid();
  carol uuid := gen_random_uuid();
  session_a uuid := gen_random_uuid();
  session_b uuid := gen_random_uuid();
  session_c uuid := gen_random_uuid();
  item_by_alice_1 uuid := gen_random_uuid();
  item_by_alice_2 uuid := gen_random_uuid();
begin
  insert into public.teams (id, name) values (team_a, 'RLS Library Delete Test Team');

  insert into auth.users (id, email) values
    (alice, 'rls-lib-alice@example.test'),
    (bob, 'rls-lib-bob@example.test'),
    (carol, 'rls-lib-carol@example.test');

  insert into public.profiles (id, name, role) values
    (alice, 'Alice', '一般'),
    (bob, 'Bob', '一般'),
    (carol, 'Carol', '指導者');

  insert into public.team_memberships (user_id, team_id, role) values
    (alice, team_a, '一般'),
    (bob, team_a, '一般'),
    (carol, team_a, '指導者');

  insert into public.active_team_sessions (session_id, user_id, team_id) values
    (session_a, alice, team_a),
    (session_b, bob, team_a),
    (session_c, carol, team_a);

  insert into public.library_items (id, team_id, uploader_id, title) values
    (item_by_alice_1, team_a, alice, 'Aliceのファイル1'),
    (item_by_alice_2, team_a, alice, 'Aliceのファイル2');

  perform set_config('tests.alice', alice::text, true);
  perform set_config('tests.bob', bob::text, true);
  perform set_config('tests.carol', carol::text, true);
  perform set_config('tests.session_a', session_a::text, true);
  perform set_config('tests.session_b', session_b::text, true);
  perform set_config('tests.session_c', session_c::text, true);
  perform set_config('tests.item1', item_by_alice_1::text, true);
  perform set_config('tests.item2', item_by_alice_2::text, true);
end $$;

-- Bob(アップロード本人でも指導者・管理者でもない一般)はAliceのファイルを削除できない。
select tests.authenticate_as(current_setting('tests.bob')::uuid, current_setting('tests.session_b')::uuid);
delete from public.library_items where id = current_setting('tests.item1')::uuid;
select is(
  (select count(*) from public.library_items where id = current_setting('tests.item1')::uuid)::int,
  1,
  'アップロード本人でも指導者・管理者でもない一般ロールはRLSにより他人のファイルを削除できない(行が残る)'
);

-- Carol(指導者)は他人(Alice)がアップロードしたファイルを削除できる。
select tests.authenticate_as(current_setting('tests.carol')::uuid, current_setting('tests.session_c')::uuid);
delete from public.library_items where id = current_setting('tests.item2')::uuid;
select is(
  (select count(*) from public.library_items where id = current_setting('tests.item2')::uuid)::int,
  0,
  '指導者は他人がアップロードしたファイルを削除できる'
);

-- Alice(アップロード本人)は自分のファイルを削除できる。
select tests.authenticate_as(current_setting('tests.alice')::uuid, current_setting('tests.session_a')::uuid);
delete from public.library_items where id = current_setting('tests.item1')::uuid;
select is(
  (select count(*) from public.library_items where id = current_setting('tests.item1')::uuid)::int,
  0,
  'アップロード本人は自分のファイルを削除できる'
);

select * from finish();

rollback;
