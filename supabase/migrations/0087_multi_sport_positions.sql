-- 複数競技対応 Phase B: 選手のポジション選択肢を全競技分に拡張する。
-- バリデーションは全競技のコードを合わせたunion一つで行い(チームごとの動的制約はかけない)、
-- どの選択肢を見せるかはアプリ側(POSITIONS_BY_SPORT)でチームの競技ごとに絞り込む。

-- 既存のcheck制約名を決め打ちせず、players.positionsに付いているcheck制約を動的に探して置き換える。
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.players'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%positions%';
  if cname is not null then
    execute format('alter table public.players drop constraint %I', cname);
  end if;
end $$;

alter table public.players add constraint players_positions_check
  check (positions <@ array[
    'PG','SG','SF','PF','C',
    'GK','DF','MF','FW',
    '投','捕','一','二','三','遊','左','中','右',
    'S','OH','MB','OP','L'
  ]);
