-- ライブラリのカテゴリー削除権限テスト。指導者・管理者(スタッフ)のみが
-- カテゴリーを削除できることを確認する。tests.authenticate_as()は
-- rls_cross_team.test.sql等と共通。

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
  bob uuid := gen_random_uuid();
  carol uuid := gen_random_uuid();
  session_b uuid := gen_random_uuid();
  session_c uuid := gen_random_uuid();
  cat1 uuid := gen_random_uuid();
  item1 uuid := gen_random_uuid();
begin
  insert into public.teams (id, name) values (team_a, 'RLS Library Category Delete Test Team');

  insert into auth.users (id, email) values
    (bob, 'rls-catdel-bob@example.test'),
    (carol, 'rls-catdel-carol@example.test');

  insert into public.profiles (id, name, role) values
    (bob, 'Bob', '一般'),
    (carol, 'Carol', '指導者');

  insert into public.team_memberships (user_id, team_id, role) values
    (bob, team_a, '一般'),
    (carol, team_a, '指導者');

  insert into public.active_team_sessions (session_id, user_id, team_id) values
    (session_b, bob, team_a),
    (session_c, carol, team_a);

  insert into public.library_categories (id, team_id, name) values (cat1, team_a, '削除対象カテゴリー');
  insert into public.library_items (id, team_id, uploader_id, category_id, title) values
    (item1, team_a, bob, cat1, 'Bobの資料');

  perform set_config('tests.bob', bob::text, true);
  perform set_config('tests.carol', carol::text, true);
  perform set_config('tests.session_b', session_b::text, true);
  perform set_config('tests.session_c', session_c::text, true);
  perform set_config('tests.cat1', cat1::text, true);
  perform set_config('tests.item1', item1::text, true);
end $$;

-- Bob(一般)はカテゴリーを削除できない。
select tests.authenticate_as(current_setting('tests.bob')::uuid, current_setting('tests.session_b')::uuid);
delete from public.library_categories where id = current_setting('tests.cat1')::uuid;
select is(
  (select count(*) from public.library_categories where id = current_setting('tests.cat1')::uuid)::int,
  1,
  '一般ロールはカテゴリーを削除できない(行が残る)'
);

-- Carol(指導者)はカテゴリーを削除できる。
select tests.authenticate_as(current_setting('tests.carol')::uuid, current_setting('tests.session_c')::uuid);
delete from public.library_categories where id = current_setting('tests.cat1')::uuid;
select is(
  (select count(*) from public.library_categories where id = current_setting('tests.cat1')::uuid)::int,
  0,
  '指導者はカテゴリーを削除できる'
);

-- 削除されたカテゴリーに属していた資料は、on delete set nullによりカテゴリーなしになる。
select is(
  (select category_id from public.library_items where id = current_setting('tests.item1')::uuid),
  null::uuid,
  'カテゴリー削除後、そのカテゴリーだった資料のcategory_idはnullになる'
);

select * from finish();

rollback;
