-- 複数競技対応 Phase A: チームが対応する競技を選べるようにする。
-- 対応競技は5つ: バスケットボール/ミニバスケットボール(既存の詳細スタッツ機能はミニバスケ実装)/
-- サッカー・ミニサッカー/野球・軟式野球/バレーボール。
alter table public.teams
  add column sport text not null default 'ミニバスケットボール'
  check (sport in (
    'バスケットボール', 'ミニバスケットボール', 'サッカー・ミニサッカー', '野球・軟式野球', 'バレーボール'
  ));
-- DEFAULT付きADD COLUMNのため既存の都賀ビクトリーズ行も自動でミニバスケになる(実態通り)。

-- 引数を3つに増やすため、旧シグネチャ(2引数)のままだとcreate or replaceで
-- 上書きされず別関数として並存してしまう。明示的に旧関数を削除してから作り直す。
drop function if exists public.create_team_and_admin(text, text);

create or replace function public.create_team_and_admin(
  team_name text, admin_name text, team_sport text default 'ミニバスケットボール'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_team_id uuid;
begin
  if auth.uid() is null then
    raise exception '認証が必要です';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'このアカウントは既にチームに所属しています';
  end if;
  if team_sport not in ('バスケットボール','ミニバスケットボール','サッカー・ミニサッカー','野球・軟式野球','バレーボール') then
    raise exception 'invalid sport: %', team_sport;
  end if;

  insert into public.teams (name, sport) values (team_name, team_sport) returning id into new_team_id;
  insert into public.profiles (id, team_id, name, role, status)
  values (auth.uid(), new_team_id, admin_name, '管理者', 'アクティブ');

  return new_team_id;
end;
$$;

grant execute on function public.create_team_and_admin(text, text, text) to authenticated;
