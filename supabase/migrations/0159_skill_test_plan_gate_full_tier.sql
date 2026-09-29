begin;

-- 2026-09料金改定でhasSkillTestAccess(src/lib/plan.ts)がMax限定からフル(Pro)プラン以上
-- (フル/フルプラス/Max/Max Partner/Signature Edition)に拡張され、アプリ側の画面ガード
-- (検定管理タブの表示等)もそれに追随したが、0104で追加したDBトリガーenforce_skill_test_max_plan/
-- enforce_skill_test_progress_max_plan は「team_plan in ('Max','max_partner','signature_edition')」
-- のまま据え置かれていた。このため、フル・フルプラスのチームは検定管理の画面自体は見えるのに、
-- 検定の作成(skill_tests insert)・ランク登録(player_skill_test_progress insert、スタッフの
-- 直接登録・承認済み申請の反映トリガーの両方を含む)がすべてこのトリガーで
-- 「検定機能はMax/Max Partner/Signature Edition限定です」として拒否される状態だった。
-- hasSkillTestAccessと同じ対象プランに揃える。

create or replace function public.enforce_skill_test_max_plan()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  team_plan text;
begin
  select plan into team_plan from public.teams where id = new.team_id;
  if team_plan not in ('フル', 'フルプラス', 'Max', 'max_partner', 'signature_edition') then
    raise exception '検定機能はフルプラン以上限定です';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_skill_test_progress_max_plan()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  team_plan text;
begin
  select plan into team_plan from public.teams where id = new.team_id;
  if team_plan not in ('フル', 'フルプラス', 'Max', 'max_partner', 'signature_edition') then
    raise exception '検定機能はフルプラン以上限定です';
  end if;
  return new;
end;
$$;

commit;
