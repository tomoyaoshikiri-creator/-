-- 練習メニューを「予定ごとに1件を上書き」から「保存するたびに追記されるリスト」に変更する。
-- 制約名が環境によって異なる場合があるため、schedule_id上のunique制約を名前を問わず動的に探して外す。
do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'public.practice_menus'::regclass
    and contype = 'u';
  if con_name is not null then
    execute format('alter table public.practice_menus drop constraint %I', con_name);
  end if;
end $$;
