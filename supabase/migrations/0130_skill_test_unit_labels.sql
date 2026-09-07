begin;

-- 級・段それぞれの呼び方を検定ごとに自由に変更できるようにする(既定は「級」「段」)。
alter table public.skill_tests
  add column kyu_label text not null default '級' check (char_length(trim(kyu_label)) between 1 and 10),
  add column dan_label text not null default '段' check (char_length(trim(dan_label)) between 1 and 10);

-- 引数の数が増えるため、既存関数のcreate or replaceでは差し替えられず、事前にdropが必要
-- (0122のlist_team_members等と同じ理由)。
drop function if exists public.skill_test_level_label(int, int, int, int);
create or replace function public.skill_test_level_label(
  kyu_count int, dan_count int, level_index int,
  dan_kyu_count int default 0, kyu_label text default '級', dan_label text default '段'
)
returns text
language sql
immutable
as $$
  select case
    when level_index < 0 or level_index >= kyu_count + dan_count * greatest(dan_kyu_count, 1) then null
    when level_index < kyu_count then (kyu_count - level_index) || kyu_label
    else
      (case when (level_index - kyu_count) / greatest(dan_kyu_count, 1) = 0 then '初' || dan_label
            else ((level_index - kyu_count) / greatest(dan_kyu_count, 1) + 1) || dan_label end)
      || (case when dan_kyu_count > 0 then ((level_index - kyu_count) % dan_kyu_count + 1) || kyu_label else '' end)
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
  select kyu_count, dan_count, dan_kyu_count, kyu_label, dan_label, level_names into st
    from public.skill_tests
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
    public.skill_test_level_label(
      st.kyu_count, st.dan_count, new.level_index, st.dan_kyu_count, st.kyu_label, st.dan_label
    )
  );
  return new;
end;
$$;

commit;
