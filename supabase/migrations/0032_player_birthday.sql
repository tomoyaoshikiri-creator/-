-- 選手の誕生日を追加し、カレンダー(全ロールが見る)に反映できるよう
-- list_roster_players()経由で公開する(選手一覧タブ本体のRLSは変更しない)。
alter table public.players add column birthday date;

drop function if exists public.list_roster_players();
create function public.list_roster_players()
returns table (id uuid, sei text, mei text, grade text, status text, birthday date)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.sei, p.mei, p.grade, p.status, p.birthday
  from public.players p
  where p.team_id = public.current_team_id()
    and p.status = '在籍';
$$;

grant execute on function public.list_roster_players() to authenticated;
