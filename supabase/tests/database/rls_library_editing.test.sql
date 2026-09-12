-- ライブラリの編集権限テスト。資料(library_items)のタイトル・カテゴリー更新は
-- アップロード本人・スタッフ(指導者・管理者)のみ可能、カテゴリー名(library_categories)の
-- リネームはスタッフのみ可能であることを確認する。
-- tests.authenticate_as()はrls_cross_team.test.sql/rls_library_delete.test.sqlと共通。

begin;

create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;

select plan(4);

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
  cat1 uuid := gen_random_uuid();
  item_by_alice uuid := gen_random_uuid();
begin
  insert into public.teams (id, name) values (team_a, 'RLS Library Editing Test Team');

  insert into auth.users (id, email) values
    (alice, 'rls-edit-alice@example.test'),
    (bob, 'rls-edit-bob@example.test'),
    (carol, 'rls-edit-carol@example.test');

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

  insert into public.library_categories (id, team_id, name) values (cat1, team_a, '元の名前');
  insert into public.library_items (id, team_id, uploader_id, category_id, title) values
    (item_by_alice, team_a, alice, cat1, 'Aliceの資料');

  perform set_config('tests.alice', alice::text, true);
  perform set_config('tests.bob', bob::text, true);
  perform set_config('tests.carol', carol::text, true);
  perform set_config('tests.session_a', session_a::text, true);
  perform set_config('tests.session_b', session_b::text, true);
  perform set_config('tests.session_c', session_c::text, true);
  perform set_config('tests.cat1', cat1::text, true);
  perform set_config('tests.item', item_by_alice::text, true);
end $$;

-- Bob(アップロード本人でも指導者・管理者でもない一般)はAliceの資料のタイトルを更新できない。
select tests.authenticate_as(current_setting('tests.bob')::uuid, current_setting('tests.session_b')::uuid);
update public.library_items set title = 'Bobによる改変' where id = current_setting('tests.item')::uuid;
select is(
  (select title from public.library_items where id = current_setting('tests.item')::uuid),
  'Aliceの資料',
  'アップロード本人でも指導者・管理者でもない一般ロールはRLSにより他人の資料を更新できない'
);

-- Alice(アップロード本人)は自分の資料のタイトルを更新できる。
select tests.authenticate_as(current_setting('tests.alice')::uuid, current_setting('tests.session_a')::uuid);
update public.library_items set title = 'Aliceによる更新' where id = current_setting('tests.item')::uuid;
select is(
  (select title from public.library_items where id = current_setting('tests.item')::uuid),
  'Aliceによる更新',
  'アップロード本人は自分の資料を更新できる'
);

-- Bob(一般)はカテゴリー名をリネームできない。
select tests.authenticate_as(current_setting('tests.bob')::uuid, current_setting('tests.session_b')::uuid);
update public.library_categories set name = 'Bobによる改変' where id = current_setting('tests.cat1')::uuid;
select is(
  (select name from public.library_categories where id = current_setting('tests.cat1')::uuid),
  '元の名前',
  '一般ロールはカテゴリー名をリネームできない'
);

-- Carol(指導者)はカテゴリー名をリネームできる。
select tests.authenticate_as(current_setting('tests.carol')::uuid, current_setting('tests.session_c')::uuid);
update public.library_categories set name = 'Carolによるリネーム' where id = current_setting('tests.cat1')::uuid;
select is(
  (select name from public.library_categories where id = current_setting('tests.cat1')::uuid),
  'Carolによるリネーム',
  '指導者はカテゴリー名をリネームできる'
);

select * from finish();

rollback;
