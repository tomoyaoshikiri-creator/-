-- 複数競技対応 Phase D: バスケットボール・ミニバスケットボール以外の競技向けに、
-- チームが自由に定義するカスタムスタッツ項目のデータモデルを追加する。
-- 「紙のスコアを打ち込める」レベルの単純な数値入力のため、バスケのようなタップ加算式の
-- イベントログ(game_stat_events)は持たず、選手×試合×項目で1行・数値を1つだけ持つ形にする。

create table public.team_stat_categories (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (team_id, name)
);

create table public.game_player_stat_entries (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  match_id uuid not null references public.game_matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  category_id uuid not null references public.team_stat_categories(id) on delete cascade,
  value numeric(6,1) not null default 0 check (value >= 0),
  updated_at timestamptz not null default now(),
  unique (match_id, player_id, category_id)
);
create index game_player_stat_entries_match_id_idx on public.game_player_stat_entries(match_id);
create index game_player_stat_entries_player_id_idx on public.game_player_stat_entries(player_id);

alter table public.team_stat_categories enable row level security;
alter table public.game_player_stat_entries enable row level security;

-- カテゴリー閲覧は全ロール(選手名と同じくラベルとして表示するだけなので絞らない)。
create policy team_stat_categories_select on public.team_stat_categories for select
  using (team_id = public.current_team_id());
create policy team_stat_categories_insert on public.team_stat_categories for insert
  with check (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));
create policy team_stat_categories_update on public.team_stat_categories for update
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'))
  with check (team_id = public.current_team_id());
create policy team_stat_categories_delete on public.team_stat_categories for delete
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));

-- game_player_stat_lines(0057)と同じ形: 記録は指導者・管理者のみ、閲覧はスタッフ+紐づく保護者本人。
create policy game_player_stat_entries_select on public.game_player_stat_entries for select
  using (
    team_id = public.current_team_id()
    and (
      public.current_role() in ('指導者', '管理者')
      or exists (
        select 1 from public.player_guardians pg
        where pg.player_id = game_player_stat_entries.player_id and pg.profile_id = auth.uid()
      )
    )
  );
create policy game_player_stat_entries_insert on public.game_player_stat_entries for insert
  with check (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));
create policy game_player_stat_entries_update on public.game_player_stat_entries for update
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'))
  with check (team_id = public.current_team_id());
create policy game_player_stat_entries_delete on public.game_player_stat_entries for delete
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));

-- チーム平均(保護者向け)。team_game_stat_averages(0076)と同じ「個別行は見せず集計のみ返す」方式。
create function public.team_stat_category_averages(p_fiscal_year int)
returns table (category_id uuid, category_name text, "position" int, player_count int, avg_value numeric)
language sql
security definer
stable
set search_path = public
as $$
  with entries as (
    select gpse.* from public.game_player_stat_entries gpse
    join public.game_matches gm on gm.id = gpse.match_id
    join public.schedules s on s.id = gm.schedule_id
    where gpse.team_id = public.current_team_id()
      and coalesce(s.fiscal_year_override,
            case when extract(month from s.date)::int >= 4
              then extract(year from s.date)::int else extract(year from s.date)::int - 1 end
          ) = p_fiscal_year
  ),
  per_player as (
    select category_id, player_id, sum(value) as total from entries group by category_id, player_id
  )
  select c.id, c.name, c.position,
    count(pp.player_id)::int,
    coalesce(round(avg(pp.total), 1), 0)
  from public.team_stat_categories c
  left join per_player pp on pp.category_id = c.id
  where c.team_id = public.current_team_id()
  group by c.id, c.name, c.position
  order by c.position, c.name
$$;

grant execute on function public.team_stat_category_averages(int) to authenticated;
