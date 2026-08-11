-- 練習メニューを「予定ごとに1件を上書き」から「保存するたびに追記されるリスト」に変更する。
alter table public.practice_menus drop constraint practice_menus_schedule_id_key;
