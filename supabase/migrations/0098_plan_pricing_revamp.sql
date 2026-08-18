-- 料金プラン改定に伴うDB側の変更。
-- ライブラリ容量の上限をプランごとに新しい値へ変更する
-- (お試し100MB / 中間1GB / フル5GB(変更なし) / フルプラス5GB(変更なし) / Max10GB)。
-- 既存チームの容量はこのトリガー経由で自動的に新しい値へ揃う。

create or replace function public.sync_team_storage_limit()
returns trigger
language plpgsql
as $$
begin
  new.storage_limit_bytes := case new.plan
    when 'お試し' then 104857600     -- 100MiB
    when '中間' then 1073741824      -- 1GiB
    when 'フル' then 5368709120      -- 5GiB
    when 'フルプラス' then 5368709120  -- 5GiB(フルと同じ)
    when 'Max' then 10737418240      -- 10GiB
  end;
  return new;
end;
$$;

-- 既存チームの容量を新しい値に反映させる(plan値自体は変えず、トリガーだけ再実行する)。
update public.teams set plan = plan;

-- ライブラリのアップロードは、これまでstorage_limit_bytes/team_storage_usage_bytes()の
-- 値がUI上に表示されるだけで、実際にアップロードを拒否する仕組みがなかった。
-- アプリ側(クライアント)でもチェックするが、URL直接操作等をすり抜けないよう
-- DBトリガーでも強制する(enforce_player_limit_triggerと同じ考え方)。
create or replace function public.enforce_library_storage_limit()
returns trigger
language plpgsql
as $$
declare
  limit_bytes bigint;
  current_usage bigint;
begin
  select storage_limit_bytes into limit_bytes from public.teams where id = public.current_team_id();
  current_usage := public.team_storage_usage_bytes();
  if limit_bytes is not null and current_usage + new.size_bytes > limit_bytes then
    raise exception 'ストレージ容量の上限を超えるため保存できません';
  end if;
  return new;
end;
$$;

create trigger enforce_library_storage_limit_trigger
before insert on public.library_files
for each row execute function public.enforce_library_storage_limit();
