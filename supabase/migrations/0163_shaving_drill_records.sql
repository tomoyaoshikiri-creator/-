begin;

-- シェービングドリル。コービーシューティング(0162)と同じくSignature Edition専用の
-- 実験的機能。前前・前後・後前・後後の4種目を、決まった時間(プリセット3分/5分または
-- 任意の秒数)内に何回できたかを記録する。コービーと異なり結果のみを入力する
-- (タイマー計測UIは持たない)ため、shotsのような過程データは持たない。

create table public.shaving_drill_records (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  recorded_on date not null,
  duration_sec int not null check (duration_sec > 0),
  -- 4種目(前前・前後・後前・後後)の回数。順序・ラベルはアプリ側(src/lib/shavingDrill.ts)で固定。
  move1_count int not null check (move1_count >= 0),
  move2_count int not null check (move2_count >= 0),
  move3_count int not null check (move3_count >= 0),
  move4_count int not null check (move4_count >= 0),
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shaving_drill_records_team_player_date_idx
  on public.shaving_drill_records (team_id, player_id, recorded_on desc);

alter table public.shaving_drill_records enable row level security;

-- 閲覧・登録・編集・削除の方針はshooting_drill_records(0162)と完全に同じ
-- (指導者・管理者は全選手、一般・運営は紐づく選手の閲覧のみ)。
create policy shaving_drill_records_select on public.shaving_drill_records for select
  using (
    team_id = public.current_team_id()
    and (
      public.current_role() in ('指導者', '管理者')
      or exists (
        select 1 from public.player_guardians pg
        where pg.player_id = shaving_drill_records.player_id and pg.profile_id = auth.uid()
      )
    )
  );

create policy shaving_drill_records_insert on public.shaving_drill_records for insert
  with check (
    team_id = public.current_team_id()
    and public.current_role() in ('指導者', '管理者')
    and recorded_by = auth.uid()
  );

create policy shaving_drill_records_update on public.shaving_drill_records for update
  using (
    team_id = public.current_team_id()
    and public.current_role() in ('指導者', '管理者')
  )
  with check (team_id = public.current_team_id());

create policy shaving_drill_records_delete on public.shaving_drill_records for delete
  using (
    team_id = public.current_team_id()
    and public.current_role() in ('指導者', '管理者')
  );

-- プラン検証トリガー(0162のenforce_shooting_drill_planと同じ多層防御)。
create or replace function public.enforce_shaving_drill_plan()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  team_plan text;
begin
  select plan into team_plan from public.teams where id = new.team_id;
  if team_plan not in ('signature_edition') then
    raise exception 'シェービングドリルはSignature Edition限定です';
  end if;
  return new;
end;
$$;

create trigger enforce_shaving_drill_plan_trigger
before insert or update on public.shaving_drill_records
for each row execute function public.enforce_shaving_drill_plan();

commit;
