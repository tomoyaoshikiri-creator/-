begin;

-- 「段」を番号(初段/2段…)ではなく、「スタート編」「入門編」のような名前付きチャプターの
-- リストとして持てるようにする。各チャプターは名前(name)と、その中の級の数(kyu_count)を
-- 個別に(バラバラに)持つ。例: [{"name":"スタート編","kyu_count":4},
-- {"name":"入門編","kyu_count":10}] のように設定すると、「スタート編4級→…→スタート編1級→
-- 入門編10級→…→入門編1級」という並びになる。
--
-- chaptersが空配列(既定)の場合は、これまで通りdan_count/dan_kyu_count/dan_labelによる
-- 番号付きの段(初段/2段…)のままになる(既存の検定・記録に影響しない後方互換フォールバック)。
alter table public.skill_tests
  add column chapters jsonb not null default '[]'::jsonb;

-- 0099の「級0・段0は不可」制約は、チャプターで段側を表現するテスト(dan_count=0のまま
-- チャプターだけ設定するケース)を弾いてしまうため、チャプター設定済みなら許可するよう緩める。
alter table public.skill_tests drop constraint skill_tests_check;
alter table public.skill_tests
  add constraint skill_tests_check check (kyu_count + dan_count >= 1 or jsonb_array_length(chapters) > 0);

-- 引数が増えるため、既存関数のcreate or replaceでは差し替えられず、事前にdropが必要。
drop function if exists public.skill_test_level_label(int, int, int, int, text, text);
create or replace function public.skill_test_level_label(
  kyu_count int, dan_count int, level_index int,
  dan_kyu_count int default 0, kyu_label text default '級', dan_label text default '段',
  chapters jsonb default '[]'::jsonb
)
returns text
language plpgsql
immutable
as $$
declare
  offset_in_dan int;
  chapter jsonb;
  chapter_kyu int;
  cumulative int := 0;
  chapter_count int := jsonb_array_length(chapters);
  i int;
begin
  if level_index < 0 then
    return null;
  end if;
  if level_index < kyu_count then
    return (kyu_count - level_index) || kyu_label;
  end if;
  offset_in_dan := level_index - kyu_count;

  if chapter_count > 0 then
    for i in 0 .. chapter_count - 1 loop
      chapter := chapters -> i;
      chapter_kyu := coalesce((chapter ->> 'kyu_count')::int, 0);
      if offset_in_dan < cumulative + chapter_kyu then
        return (chapter ->> 'name') || (chapter_kyu - (offset_in_dan - cumulative)) || kyu_label;
      end if;
      cumulative := cumulative + chapter_kyu;
    end loop;
    return null;
  end if;

  -- 後方互換: チャプター未設定の検定は、従来通り番号付きの段(初段/2段…)として扱う。
  if dan_count <= 0 or offset_in_dan >= dan_count * greatest(dan_kyu_count, 1) then
    return null;
  end if;
  return
    (case when offset_in_dan / greatest(dan_kyu_count, 1) = 0 then '初' || dan_label
          else (offset_in_dan / greatest(dan_kyu_count, 1) + 1) || dan_label end)
    || (case when dan_kyu_count > 0 then (offset_in_dan % dan_kyu_count + 1) || kyu_label else '' end);
end;
$$;

create or replace function public.set_skill_test_progress_label()
returns trigger
language plpgsql
as $$
declare
  st record;
  custom_name text;
  chapter_count int;
  chapters_total int := 0;
  max_index int;
  i int;
begin
  select kyu_count, dan_count, dan_kyu_count, kyu_label, dan_label, chapters, level_names into st
    from public.skill_tests
    where id = new.skill_test_id and team_id = new.team_id;
  if not found then
    raise exception '検定が見つかりません';
  end if;

  chapter_count := jsonb_array_length(st.chapters);
  if chapter_count > 0 then
    for i in 0 .. chapter_count - 1 loop
      chapters_total := chapters_total + coalesce(((st.chapters -> i) ->> 'kyu_count')::int, 0);
    end loop;
    max_index := st.kyu_count + chapters_total;
  else
    max_index := st.kyu_count + st.dan_count * greatest(st.dan_kyu_count, 1);
  end if;
  if new.level_index >= max_index then
    raise exception '不正なランクです';
  end if;

  custom_name := nullif(st.level_names ->> new.level_index::text, '');
  new.level_label := coalesce(
    custom_name,
    public.skill_test_level_label(
      st.kyu_count, st.dan_count, new.level_index, st.dan_kyu_count, st.kyu_label, st.dan_label, st.chapters
    )
  );
  return new;
end;
$$;

commit;
