-- 指導者等、選手以外のメンバーも誕生日を登録できるようにする(月日のみ、年は使わない
-- ため固定のうるう年を仮の年として保存し、表示側では常にMM-DD部分だけを使う。選手の
-- birthdayと同じ扱い)。自己登録のため選手のbirthday_visibleのような可視性トグルは
-- 持たせない(登録する=公開する前提)。
alter table public.profiles add column birthday date;

-- team_membershipsはRLSポリシーが無く直接SELECTできないため、list_team_members()と
-- 同じ考え方で読み取り専用RPC経由にする。誕生日未登録のメンバーは除外する。
create function public.list_team_member_birthdays()
returns table(id uuid, name text, birthday date)
language sql
stable security definer
set search_path to 'public'
as $$
  select p.id, p.name, p.birthday
  from public.team_memberships tm
  join public.profiles p on p.id = tm.user_id
  where tm.team_id = public.current_team_id()
    and p.birthday is not null
$$;
