begin;

-- 各段の中にも級(サブランク)を持てるようにする。
-- dan_kyu_count = 0(既定)の場合は従来通り、段はサブランクなしの単一ランク(初段/2段/…)。
-- dan_kyu_count = N(>=1)の場合、各段が「(段名)1級」〜「(段名)N級」のN段階に分かれる
-- (例: 初段1級→初段2級→…→初段N級→2段1級→…)。既存の検定にもあとから設定できる。
alter table public.skill_tests
  add column dan_kyu_count int not null default 0 check (dan_kyu_count between 0 and 30);

-- level_index → 表示ラベルの変換をdan_kyu_countを考慮したものに更新する。引数の数が
-- 増えるため、0099のcreate or replaceでは差し替えられず、事前にdropが必要
-- (0122のlist_team_members等と同じ理由)。
drop function if exists public.skill_test_level_label(int, int, int);
create or replace function public.skill_test_level_label(
  kyu_count int, dan_count int, level_index int, dan_kyu_count int default 0
)
returns text
language sql
immutable
as $$
  select case
    when level_index < 0 or level_index >= kyu_count + dan_count * greatest(dan_kyu_count, 1) then null
    when level_index < kyu_count then (kyu_count - level_index) || '級'
    else
      (case when (level_index - kyu_count) / greatest(dan_kyu_count, 1) = 0 then '初段'
            else ((level_index - kyu_count) / greatest(dan_kyu_count, 1) + 1) || '段' end)
      || (case when dan_kyu_count > 0 then ((level_index - kyu_count) % dan_kyu_count + 1) || '級' else '' end)
  end;
$$;

create or replace function public.set_skill_test_progress_label()
returns trigger
language plpgsql
as $$
declare
  st record;
  custom_name text;
begin
  select kyu_count, dan_count, dan_kyu_count, level_names into st from public.skill_tests
    where id = new.skill_test_id and team_id = new.team_id;
  if not found then
    raise exception '検定が見つかりません';
  end if;
  if new.level_index >= st.kyu_count + st.dan_count * greatest(st.dan_kyu_count, 1) then
    raise exception '不正なランクです';
  end if;
  custom_name := nullif(st.level_names ->> new.level_index::text, '');
  new.level_label := coalesce(
    custom_name,
    public.skill_test_level_label(st.kyu_count, st.dan_count, new.level_index, st.dan_kyu_count)
  );
  return new;
end;
$$;

commit;
