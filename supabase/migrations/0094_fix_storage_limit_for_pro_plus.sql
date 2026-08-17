-- 0093でteams.planに'フルプラス'を追加した際、ストレージ上限を自動同期する
-- sync_team_storage_limit()トリガー関数(0075/0084)の更新が漏れていた。
-- CASE式にフルプラスの分岐がないとnew.storage_limit_bytesがNULLになり、
-- not null制約違反でUPDATEが失敗する不具合を修正する。
-- 容量はフル・Maxと同じ5GiBとする(Pro AI Plusはフルの機能+AI分析のみのため)。

create or replace function public.sync_team_storage_limit()
returns trigger
language plpgsql
as $$
begin
  new.storage_limit_bytes := case new.plan
    when 'お試し' then 314572800   -- 300MiB
    when '中間' then 2147483648    -- 2GiB
    when 'フル' then 5368709120    -- 5GiB
    when 'フルプラス' then 5368709120  -- 5GiB(フルと同じ)
    when 'Max' then 5368709120     -- 5GiB(フルと同じ)
  end;
  return new;
end;
$$;
