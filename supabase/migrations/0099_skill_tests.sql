-- 検定(ドリブル検定など、チームが任意の名前・級/段の数で作成する技能検定)の進捗管理。Maxプラン限定。
-- 級・段の数はチームごとに自由に設定できるようにする(例: 10級〜5段、5級〜3段、級なしで1段〜10段、等)。
-- 進捗は追記型のログとして持ち、最新の1件(created_at desc limit 1)がその選手の現在のランクになる。
-- level_index はそのテストの中での並び順(0始まり、級側から段側に向かって昇順)。
-- level_label は記録した時点のkyu_count/dan_countから計算した表示用ラベルをそのまま保存する
-- (あとでテストの級/段の数を変更しても、過去の記録の表示が変わらないようにするため)。

create table public.skill_tests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  kyu_count int not null default 10 check (kyu_count between 0 and 30),
  dan_count int not null default 5 check (dan_count between 0 and 30),
  created_at timestamptz not null default now(),
  unique (team_id, name),
  check (kyu_count + dan_count >= 1)
);

create table public.player_skill_test_progress (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  skill_test_id uuid not null references public.skill_tests(id) on delete cascade,
  level_index int not null check (level_index >= 0),
  level_label text not null,
  achieved_on date not null default current_date,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index player_skill_test_progress_player_idx
  on public.player_skill_test_progress(player_id, skill_test_id, created_at desc);
create index player_skill_test_progress_team_idx
  on public.player_skill_test_progress(team_id, created_at);

alter table public.skill_tests enable row level security;
alter table public.player_skill_test_progress enable row level security;

-- 検定名・級/段の数の閲覧はteam_stat_categoriesと同じくラベル表示のみなので広く開放。
-- 作成・編集・削除はカルテタブ(指導者・管理者限定)からのみ行うため、そのロールに絞る。
create policy skill_tests_select on public.skill_tests for select
  using (team_id = public.current_team_id());
create policy skill_tests_insert on public.skill_tests for insert
  with check (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));
create policy skill_tests_update on public.skill_tests for update
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'))
  with check (team_id = public.current_team_id());
create policy skill_tests_delete on public.skill_tests for delete
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));

-- 進捗の閲覧はスタッフ全員+紐づく保護者本人(スポーツテストや身長体重と同じ方針)。
-- 登録はカルテ画面からのみなので指導者・管理者限定。追記型ログのため更新・削除ポリシーは設けない。
create policy player_skill_test_progress_select on public.player_skill_test_progress for select
  using (
    team_id = public.current_team_id()
    and (
      public.current_role() in ('指導者', '管理者')
      or exists (
        select 1 from public.player_guardians pg
        where pg.player_id = player_skill_test_progress.player_id and pg.profile_id = auth.uid()
      )
    )
  );
create policy player_skill_test_progress_insert on public.player_skill_test_progress for insert
  with check (
    team_id = public.current_team_id()
    and public.current_role() in ('指導者', '管理者')
    and recorded_by = auth.uid()
  );

-- Maxプラン限定機能であることをDBトリガーでも強制する(enforce_player_limit等と同じ考え方)。
create or replace function public.enforce_skill_test_max_plan()
returns trigger
language plpgsql
as $$
declare
  team_plan text;
begin
  select plan into team_plan from public.teams where id = new.team_id;
  if team_plan <> 'Max' then
    raise exception '検定機能はMaxプラン限定です';
  end if;
  return new;
end;
$$;

create trigger enforce_skill_test_max_plan_trigger
before insert on public.skill_tests
for each row execute function public.enforce_skill_test_max_plan();

create or replace function public.enforce_skill_test_progress_max_plan()
returns trigger
language plpgsql
as $$
declare
  team_plan text;
begin
  select plan into team_plan from public.teams where id = new.team_id;
  if team_plan <> 'Max' then
    raise exception '検定機能はMaxプラン限定です';
  end if;
  return new;
end;
$$;

create trigger enforce_skill_test_progress_max_plan_trigger
before insert on public.player_skill_test_progress
for each row execute function public.enforce_skill_test_progress_max_plan();

-- level_index → 表示ラベル(◯級/◯段)の変換。0始まりで級側から段側に向かって並べる。
create or replace function public.skill_test_level_label(kyu_count int, dan_count int, level_index int)
returns text
language sql
immutable
as $$
  select case
    when level_index < 0 or level_index >= kyu_count + dan_count then null
    when level_index < kyu_count then (kyu_count - level_index) || '級'
    when level_index = kyu_count then '初段'
    else (level_index - kyu_count + 1) || '段'
  end;
$$;

-- level_labelはクライアントの入力値を信用せず、常にDB側でその時点のkyu_count/dan_countから
-- 計算し直す(不整合な値が記録されるのを防ぐため)。あわせてskill_test_idが同じチームのものか、
-- level_indexがそのテストの範囲内かも検証する。
create or replace function public.set_skill_test_progress_label()
returns trigger
language plpgsql
as $$
declare
  st record;
begin
  select kyu_count, dan_count into st from public.skill_tests
    where id = new.skill_test_id and team_id = new.team_id;
  if not found then
    raise exception '検定が見つかりません';
  end if;
  if new.level_index >= st.kyu_count + st.dan_count then
    raise exception '不正なランクです';
  end if;
  new.level_label := public.skill_test_level_label(st.kyu_count, st.dan_count, new.level_index);
  return new;
end;
$$;

create trigger set_skill_test_progress_label_trigger
before insert on public.player_skill_test_progress
for each row execute function public.set_skill_test_progress_label();

-- 別件: 選手の新規登録時にOBOGとして登録できてしまわないよう、DB側でも強制する
-- (UI側(NewPlayerModal)はもともとstatusを指定せず常に「在籍」で登録しているが、
-- API直叩き等で回避されないよう保険をかける)。
create or replace function public.enforce_new_player_status()
returns trigger
language plpgsql
as $$
begin
  new.status := '在籍';
  return new;
end;
$$;

create trigger enforce_new_player_status_trigger
before insert on public.players
for each row execute function public.enforce_new_player_status();
