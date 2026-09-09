begin;

-- 選手の誕生日をチーム全体への通知・カレンダー表示の対象にするかどうかを、
-- 選手ごとに設定できるようにする。デフォルトはtrue(既存選手はこれまで通り公開扱い)。
alter table public.players add column birthday_visible boolean not null default true;

-- list_roster_players()は出欠登録画面(AttendanceRosterModal)とカレンダーの誕生日表示
-- (schedule/page.tsx)の両方から使われている。誕生日そのものを非公開時はnullにして返すことで、
-- 呼び出し側(特にカレンダー側の「p.birthdayがあれば表示」というロジック)をそのまま
-- 非公開判定として使えるようにする(呼び出し側の変更は不要)。
drop function if exists public.list_roster_players();
create function public.list_roster_players()
returns table (id uuid, sei text, mei text, grade text, number text, status text, birthday date)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.sei, p.mei, p.grade, p.number, p.status,
    case when p.birthday_visible then p.birthday else null end as birthday
  from public.players p
  where p.team_id = public.current_team_id()
    and p.status = '在籍';
$$;

grant execute on function public.list_roster_players() to authenticated;

commit;
