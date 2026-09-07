begin;

-- 検定の級・段それぞれに任意の名前を設定できるようにする。
-- 未設定(該当level_indexのキーが無い/空文字)の場合は、これまで通り
-- skill_test_level_label()による自動採番のラベル(例:3級/初段)にフォールバックする。
-- level_indexをキーにしたjsonbオブジェクトとして保持する(例: {"0": "白帯", "10": "黒帯初段"})。
alter table public.skill_tests
  add column level_names jsonb not null default '{}'::jsonb;

create or replace function public.set_skill_test_progress_label()
returns trigger
language plpgsql
as $$
declare
  st record;
  custom_name text;
begin
  select kyu_count, dan_count, level_names into st from public.skill_tests
    where id = new.skill_test_id and team_id = new.team_id;
  if not found then
    raise exception '検定が見つかりません';
  end if;
  if new.level_index >= st.kyu_count + st.dan_count then
    raise exception '不正なランクです';
  end if;
  custom_name := nullif(st.level_names ->> new.level_index::text, '');
  new.level_label := coalesce(custom_name, public.skill_test_level_label(st.kyu_count, st.dan_count, new.level_index));
  return new;
end;
$$;

commit;
