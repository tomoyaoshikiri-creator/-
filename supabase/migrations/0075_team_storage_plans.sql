-- 1チームあたりのストレージ上限を3段階のプランに分ける
-- (お試し300MB / 中間2GB / フル5GB)。プランを変えるとstorage_limit_bytesが
-- 自動的に追従するようトリガーで揃える。
-- 0074で追加したstorage_limit_bytes自体は残し、値の決め方だけをここで整理し直す。

alter table public.teams add column plan text not null default 'お試し'
  check (plan in ('お試し', '中間', 'フル'));

create or replace function public.sync_team_storage_limit()
returns trigger
language plpgsql
as $$
begin
  new.storage_limit_bytes := case new.plan
    when 'お試し' then 314572800   -- 300MiB
    when '中間' then 2147483648    -- 2GiB
    when 'フル' then 5368709120    -- 5GiB
  end;
  return new;
end;
$$;

create trigger team_storage_limit_sync
before insert or update of plan on public.teams
for each row execute function public.sync_team_storage_limit();

-- 既存チーム(列追加直後はplanのデフォルト'お試し'が入っている)にもトリガーを効かせて
-- storage_limit_bytesを揃える。
update public.teams set plan = plan;

-- 都賀ビクトリーズは本番運用中のパイロットチームのため「フル」プランにしておく。
update public.teams set plan = 'フル' where name = '都賀ビクトリーズ';
