-- CLUB KARTE: スポーツテスト記録(四半期・指導者/管理者のみ)
create table public.sports_test_records (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  fiscal_year int not null,
  quarter int not null check (quarter between 1 and 4),
  wingspan_cm numeric(5,1),
  sprint20m_1 numeric(4,2),
  sprint20m_2 numeric(4,2),
  long_jump_1 int,
  long_jump_2 int,
  lane_agility_1 numeric(4,2),
  lane_agility_2 numeric(4,2),
  side_step_1 int,
  side_step_2 int,
  shuttle_20m_x3 numeric(4,2),
  ball_throw_1 numeric(4,1),
  ball_throw_2 numeric(4,1),
  back_fist_right numeric(4,1),
  back_fist_left numeric(4,1),
  ft_golf int check (ft_golf between 0 and 10),
  beep_test_reps int check (beep_test_reps >= 0),
  recorded_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (player_id, fiscal_year, quarter)
);

alter table public.sports_test_records enable row level security;

create policy sports_test_records_select on public.sports_test_records for select
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));

create policy sports_test_records_insert on public.sports_test_records for insert
  with check (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));

create policy sports_test_records_update on public.sports_test_records for update
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'))
  with check (team_id = public.current_team_id());

create policy sports_test_records_delete on public.sports_test_records for delete
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));

-- CLUB KARTE: 身長体重(週次)。選手/紐付いた保護者本人も記録できる。
create table public.player_growth_records (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  measured_on date not null,
  height_cm numeric(5,1),
  weight_kg numeric(5,1),
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (player_id, measured_on)
);

alter table public.player_growth_records enable row level security;

create policy player_growth_records_select on public.player_growth_records for select
  using (
    team_id = public.current_team_id()
    and (
      public.current_role() in ('指導者', '管理者')
      or exists (
        select 1 from public.player_guardians pg
        where pg.player_id = player_growth_records.player_id and pg.profile_id = auth.uid()
      )
    )
  );

create policy player_growth_records_insert on public.player_growth_records for insert
  with check (
    team_id = public.current_team_id()
    and recorded_by = auth.uid()
    and (
      public.current_role() in ('指導者', '管理者')
      or exists (
        select 1 from public.player_guardians pg
        where pg.player_id = player_growth_records.player_id and pg.profile_id = auth.uid()
      )
    )
  );

create policy player_growth_records_update on public.player_growth_records for update
  using (
    public.current_role() in ('指導者', '管理者')
    or exists (
      select 1 from public.player_guardians pg
      where pg.player_id = player_growth_records.player_id and pg.profile_id = auth.uid()
    )
  )
  with check (team_id = public.current_team_id());

create policy player_growth_records_delete on public.player_growth_records for delete
  using (
    public.current_role() in ('指導者', '管理者')
    or exists (
      select 1 from public.player_guardians pg
      where pg.player_id = player_growth_records.player_id and pg.profile_id = auth.uid()
    )
  );
