-- list_roster_players()に背番号(number)を追加する。出欠一覧(AttendanceRosterModal)で
-- 選手を学年→背番号順に並べ替えられるようにするため。
drop function if exists public.list_roster_players();
create function public.list_roster_players()
returns table (id uuid, sei text, mei text, grade text, number text, status text, birthday date)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.sei, p.mei, p.grade, p.number, p.status, p.birthday
  from public.players p
  where p.team_id = public.current_team_id()
    and p.status = '在籍';
$$;

grant execute on function public.list_roster_players() to authenticated;
