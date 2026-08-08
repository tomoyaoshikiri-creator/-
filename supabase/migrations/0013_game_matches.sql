-- 1日に複数試合ある場合に対応するため、予定(schedules)とクォーター記録(game_records)の間に
-- 「第◯試合・対戦相手」を表すgame_matchesを挟む。出欠・予定は1日1件のまま、
-- 試合ごとのスタメン・途中出場だけを分けて記録できるようにする。

create table public.game_matches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  game_number int not null check (game_number >= 1),
  opponent text,
  created_at timestamptz not null default now(),
  unique (schedule_id, game_number)
);
create index game_matches_schedule_id_idx on public.game_matches(schedule_id);

alter table public.game_records add column match_id uuid references public.game_matches(id) on delete cascade;

-- 既存のgame_recordsは「第1試合」として引き継ぐ
insert into public.game_matches (team_id, schedule_id, game_number)
select distinct gr.team_id, gr.schedule_id, 1
from public.game_records gr
on conflict (schedule_id, game_number) do nothing;

update public.game_records gr
set match_id = gm.id
from public.game_matches gm
where gm.schedule_id = gr.schedule_id and gm.game_number = 1;

alter table public.game_records alter column match_id set not null;
alter table public.game_records drop constraint game_records_schedule_id_quarter_key;
alter table public.game_records drop constraint game_records_schedule_id_fkey;
alter table public.game_records drop column schedule_id;
alter table public.game_records add constraint game_records_match_id_quarter_key unique (match_id, quarter);

alter table public.game_matches enable row level security;
create policy game_matches_select on public.game_matches for select
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));
create policy game_matches_insert on public.game_matches for insert
  with check (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));
create policy game_matches_update on public.game_matches for update
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));
create policy game_matches_delete on public.game_matches for delete
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));
