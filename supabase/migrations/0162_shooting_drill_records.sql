begin;

-- シュート練習記録(コービーシューティング)。Signature Edition(都賀ビクトリーズ専用)だけに
-- 搭載する実験的機能。3P→ミドル→ゴール下を繰り返し、目標点に到達するまでのタイムと
-- 種類ごとの成功/本数を記録する。drill_keyは将来ほかのシュート練習の種類を足すための区分で、
-- 現時点では'kobe'のみ。

create table public.shooting_drill_records (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  drill_key text not null default 'kobe' check (drill_key in ('kobe')),
  recorded_on date not null,
  target_points int not null check (target_points in (11, 15, 21)),
  time_sec numeric(6, 1) not null check (time_sec > 0),
  three_made int not null check (three_made >= 0),
  three_att int not null check (three_att >= 0),
  mid_made int not null check (mid_made >= 0),
  mid_att int not null check (mid_att >= 0),
  layup_made int not null check (layup_made >= 0),
  layup_att int not null check (layup_att >= 0),
  -- 総得点はアプリから書き込ませず、成功本数から常に算出する。
  total_points int generated always as (three_made * 3 + mid_made * 2 + layup_made) stored,
  -- 1本ごとの成否の並び(タイマー計測のみ記録。手入力はnull)。後の分析用。
  shots boolean[],
  input_method text not null check (input_method in ('timer', 'manual')),
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shooting_drill_records_made_le_att check (
    three_made <= three_att and mid_made <= mid_att and layup_made <= layup_att
  )
);

create index shooting_drill_records_team_player_date_idx
  on public.shooting_drill_records (team_id, player_id, recorded_on desc);

alter table public.shooting_drill_records enable row level security;

-- 閲覧: 指導者・管理者は全選手、一般・運営は自分に紐づく選手の記録だけ
-- (player_guardians突き合わせ、sports_test_records/0040と同じ考え方)。
-- スポーツテストと異なり、一般・運営はこの練習記録を自分で入力しないため、閲覧のみを許可する。
create policy shooting_drill_records_select on public.shooting_drill_records for select
  using (
    team_id = public.current_team_id()
    and (
      public.current_role() in ('指導者', '管理者')
      or exists (
        select 1 from public.player_guardians pg
        where pg.player_id = shooting_drill_records.player_id and pg.profile_id = auth.uid()
      )
    )
  );

-- 登録・修正・削除は指導者・管理者のみ(練習中にコーチがつける記録のため)。
create policy shooting_drill_records_insert on public.shooting_drill_records for insert
  with check (
    team_id = public.current_team_id()
    and public.current_role() in ('指導者', '管理者')
    and recorded_by = auth.uid()
  );

create policy shooting_drill_records_update on public.shooting_drill_records for update
  using (
    team_id = public.current_team_id()
    and public.current_role() in ('指導者', '管理者')
  )
  with check (team_id = public.current_team_id());

create policy shooting_drill_records_delete on public.shooting_drill_records for delete
  using (
    team_id = public.current_team_id()
    and public.current_role() in ('指導者', '管理者')
  );

-- プラン検証トリガー。skill_tests/sports_test_recordsと同じ多層防御(0104参照)。
-- RLSとは別に、書き込み時点でチームがsignature_editionかどうかをDBレベルでも検証する。
create or replace function public.enforce_shooting_drill_plan()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  team_plan text;
begin
  select plan into team_plan from public.teams where id = new.team_id;
  if team_plan not in ('signature_edition') then
    raise exception 'シュート練習記録はSignature Edition限定です';
  end if;
  return new;
end;
$$;

create trigger enforce_shooting_drill_plan_trigger
before insert or update on public.shooting_drill_records
for each row execute function public.enforce_shooting_drill_plan();

commit;
