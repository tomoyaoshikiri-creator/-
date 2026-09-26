-- 2026-09料金改定: お試し(Free)プランの選手登録上限を15人→20人に変更。
-- enforce_player_limit()はDB側の最終防御(APIを直接叩いても回避不可にするための保険、
-- 0084で導入)。search_path固定(0154)を維持するため、CREATE OR REPLACEでも
-- set search_path句を明示する。

create or replace function public.enforce_player_limit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  team_plan text;
  active_count int;
begin
  select plan into team_plan from public.teams where id = new.team_id;
  if team_plan = 'お試し' and (new.status is null or new.status <> 'OB・OG') then
    select count(*) into active_count from public.players
      where team_id = new.team_id and (status is null or status <> 'OB・OG');
    if active_count >= 20 then
      raise exception 'Freeプランでは選手の登録は20人までです';
    end if;
  end if;
  return new;
end;
$$;
