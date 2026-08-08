-- 選手⇔保護者アカウントの紐付け(多対多)。紐付けの登録・削除はユーザー管理画面から管理者のみ行う。
create table public.player_guardians (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (player_id, profile_id)
);
create index player_guardians_player_id_idx on public.player_guardians(player_id);
create index player_guardians_profile_id_idx on public.player_guardians(profile_id);

alter table public.player_guardians enable row level security;

create policy player_guardians_select on public.player_guardians for select
  using (
    team_id = public.current_team_id()
    and (profile_id = auth.uid() or public.current_role() in ('役員', '指導者', '管理者'))
  );
create policy player_guardians_insert on public.player_guardians for insert
  with check (team_id = public.current_team_id() and public.current_role() = '管理者');
create policy player_guardians_delete on public.player_guardians for delete
  using (team_id = public.current_team_id() and public.current_role() = '管理者');

-- 出欠を「選手」単位でも記録できるようにする。
-- identity_key: player_idがあればそれを、なければuser_id(指導者本人など)を使う一意キー。
-- (部分ユニークインデックスはPostgRESTのon_conflict推論に使えないため、生成列で一本化する)
alter table public.attendances add column player_id uuid references public.players(id) on delete cascade;
alter table public.attendances add column identity_key text
  generated always as (coalesce(player_id::text, user_id::text)) stored;

alter table public.attendances drop constraint attendances_schedule_id_user_id_key;
alter table public.attendances add constraint attendances_schedule_id_identity_key_key unique (schedule_id, identity_key);

drop policy attendances_insert on public.attendances;
create policy attendances_insert on public.attendances for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.schedules s where s.id = schedule_id and s.team_id = public.current_team_id())
    and (
      player_id is null
      or exists (
        select 1 from public.player_guardians pg
        where pg.player_id = attendances.player_id and pg.profile_id = auth.uid()
      )
    )
  );

drop policy attendances_update on public.attendances;
create policy attendances_update on public.attendances for update
  using (
    user_id = auth.uid()
    and (
      player_id is null
      or exists (
        select 1 from public.player_guardians pg
        where pg.player_id = attendances.player_id and pg.profile_id = auth.uid()
      )
    )
  );
