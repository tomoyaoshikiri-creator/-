-- Maxプラン(都賀ビクトリーズ専用の非公開プラン。スポーツテスト機能を含む)を追加する。
-- 一般には販売せず、Stripeの商品カタログにも出さない。teams.planへの手動更新でのみ設定する。
-- あわせて、Freeプラン(お試し)の選手登録数上限(15人)をDBトリガーでも強制する
-- (アプリ側のチェックに加えて、API直叩き等でも上限を超えられないようにするための保険)。

-- 既存のcheck制約名を決め打ちせず、teams.planに付いているcheck制約を動的に探して置き換える。
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.teams'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%(plan =%';
  if cname is not null then
    execute format('alter table public.teams drop constraint %I', cname);
  end if;
end $$;

alter table public.teams add constraint teams_plan_check check (plan in ('お試し', '中間', 'フル', 'Max'));

create or replace function public.sync_team_storage_limit()
returns trigger
language plpgsql
as $$
begin
  new.storage_limit_bytes := case new.plan
    when 'お試し' then 314572800   -- 300MiB
    when '中間' then 2147483648    -- 2GiB
    when 'フル' then 5368709120    -- 5GiB
    when 'Max' then 5368709120     -- 5GiB(フルと同じ)
  end;
  return new;
end;
$$;

create or replace function public.enforce_player_limit()
returns trigger
language plpgsql
as $$
declare
  team_plan text;
  active_count int;
begin
  select plan into team_plan from public.teams where id = new.team_id;
  if team_plan = 'お試し' and (new.status is null or new.status <> 'OB・OG') then
    select count(*) into active_count from public.players
      where team_id = new.team_id and (status is null or status <> 'OB・OG');
    if active_count >= 15 then
      raise exception 'Freeプランでは選手の登録は15人までです';
    end if;
  end if;
  return new;
end;
$$;

create trigger enforce_player_limit_trigger
before insert on public.players
for each row execute function public.enforce_player_limit();
