-- AI分析(選手個人・チーム全体)の利用回数を「チーム単位で月50回」として正確に
-- カウントするための専用テーブル+RPC。
--
-- 背景: 従来はAPIルート側で「player_analysis_notes/team_analysis_notesの当月件数を
-- SELECT COUNTしてから、Anthropic API呼び出し後にINSERTする」という手順を踏んでいたが、
-- このcount→(数秒かかるAPI呼び出し)→insertという流れはアトミックではなく、同時に
-- 複数リクエストが来た場合に上限(50回)を超えて生成を許してしまう競合が起こり得た。
--
-- 設計方針:
-- - player_analysis_notes/team_analysis_notes(分析結果の保存先)には一切手を加えない。
--   利用回数の管理はこのテーブルに完全に分離する。
-- - 「1行=1回の生成試行」の予約台帳(ledger)方式にする。単一行のカウンタを
--   increment/decrementする方式だと、Anthropic呼び出し中にサーバーが落ちた場合に
--   確実にdecrementするコードが実行される保証がなく、「枠だけ消費されて戻らない」
--   事故が起こり得る。台帳方式ならreserved_atが古い(タイムアウト)行は集計から
--   自動的に除外されるため、後始末処理なしに枠が自然に解放される。
-- - status: reserved(予約直後、Anthropic呼び出し中) / succeeded(生成成功・保存済み) /
--   failed(生成失敗・エラー、枠は消費しない)。
-- - 予約から一定時間(RESERVATION_TIMEOUT)経過してもreservedのままの行は、クラッシュ等で
--   resolveされなかったものとみなし、利用回数の集計から除外する(枠を自動的に解放する)。
-- - team_id + request_id にunique制約を付け、同一リクエスト(クライアント側で生成した
--   冪等キー)の再送があっても二重に予約・二重カウントされないようにする。
-- - team_id + year_month(JST基準)ごとにpg_advisory_xact_lockでロックしたうえで
--   件数確認とINSERTを行うため、同時リクエストでも上限を超えて予約されることがない。

create table public.ai_analysis_usage (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  year_month text not null, -- 'YYYY-MM'(JST基準)
  request_id uuid not null, -- クライアントが生成する冪等キー(同一操作の再送を検知する)
  status text not null default 'reserved' check (status in ('reserved', 'succeeded', 'failed')),
  reserved_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_by uuid references public.profiles(id),
  unique (team_id, request_id)
);
create index ai_analysis_usage_team_month_idx on public.ai_analysis_usage(team_id, year_month, status);

alter table public.ai_analysis_usage enable row level security;

-- 閲覧のみ許可(利用状況表示のため、指導者・管理者)。書き込みはRPC
-- (SECURITY DEFINER、RLSをバイパス)経由のみとし、クライアントからの直接
-- INSERT/UPDATE/DELETEは一切許可しない(insert/update/deleteポリシーを作らない
-- = デフォルトで拒否される)。
create policy ai_analysis_usage_select on public.ai_analysis_usage for select
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));

-- 予約中(reserved)の行を「まだ有効な予約」とみなす猶予時間。Anthropic呼び出しは
-- 非ストリーミングでSDKが自動的にタイムアウトを延長するが、実運用の生成時間
-- (数秒〜数十秒程度)に対して十分な余裕を持たせつつ、クラッシュ時に枠が
-- 長時間ロックされたままにならないようにする値。
create or replace function public.ai_analysis_usage_count(p_team_id uuid, p_year_month text)
returns int
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::int
  from public.ai_analysis_usage
  where team_id = p_team_id
    and year_month = p_year_month
    and (
      status = 'succeeded'
      or (status = 'reserved' and reserved_at > now() - interval '10 minutes')
    )
$$;

-- 現在ログイン中のユーザーのチームについて、当月(JST基準)のAI分析利用回数を返す。
-- GET /api/ai-analysisや選手カルテ・チームカルテの利用状況表示から呼び出す。
create or replace function public.get_ai_analysis_usage()
returns int
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_team_id uuid := public.current_team_id();
  v_year_month text := to_char(now() at time zone 'Asia/Tokyo', 'YYYY-MM');
begin
  if v_team_id is null or public.current_role() not in ('指導者', '管理者') then
    return 0;
  end if;
  return public.ai_analysis_usage_count(v_team_id, v_year_month);
end;
$$;

-- AI分析を1件生成する前に呼び出し、当月の利用回数が上限未満であれば1枠を
-- アトミックに予約してreservedな行のidを返す。上限に達している場合は例外を返す。
-- 同一request_idで再度呼び出された場合(ネットワーク再送等)は、新たに予約を
-- 作らず既存の予約(あるいは確定済みの結果)をそのまま返す。
create or replace function public.reserve_ai_analysis_usage(p_request_id uuid, p_monthly_limit int)
returns table (reservation_id uuid, usage_status text, used_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid := public.current_team_id();
  v_year_month text := to_char(now() at time zone 'Asia/Tokyo', 'YYYY-MM');
  v_existing public.ai_analysis_usage;
  v_count int;
  v_new_id uuid;
begin
  if v_team_id is null or public.current_role() <> '管理者' then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  -- 同一チーム・同一月内の予約処理を直列化する(同時リクエストでも上限を超えない)。
  -- トランザクション終了時に自動的に解放される。
  perform pg_advisory_xact_lock(hashtextextended(v_team_id::text || ':' || v_year_month, 0));

  select * into v_existing from public.ai_analysis_usage
    where team_id = v_team_id and request_id = p_request_id;
  if found then
    -- 同一リクエストの再送: 新たに予約を作らず、既存の状態をそのまま返す
    -- (二重カウントを防ぐ)。
    return query select v_existing.id, v_existing.status, public.ai_analysis_usage_count(v_team_id, v_year_month);
    return;
  end if;

  v_count := public.ai_analysis_usage_count(v_team_id, v_year_month);
  if v_count >= p_monthly_limit then
    raise exception 'AI_USAGE_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  insert into public.ai_analysis_usage (team_id, year_month, request_id, status, created_by)
  values (v_team_id, v_year_month, p_request_id, 'reserved', auth.uid())
  returning id into v_new_id;

  return query select v_new_id, 'reserved'::text, v_count + 1;
end;
$$;

-- 予約(reserve_ai_analysis_usage)の結果を確定する。p_succeeded=trueで生成成功・
-- 保存完了、falseで生成失敗(枠を消費しない)。
create or replace function public.resolve_ai_analysis_usage(p_reservation_id uuid, p_succeeded boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid := public.current_team_id();
begin
  update public.ai_analysis_usage
  set status = case when p_succeeded then 'succeeded' else 'failed' end,
      resolved_at = now()
  where id = p_reservation_id
    and team_id = v_team_id
    and status = 'reserved';
end;
$$;

grant execute on function public.ai_analysis_usage_count(uuid, text) to authenticated;
grant execute on function public.get_ai_analysis_usage() to authenticated;
grant execute on function public.reserve_ai_analysis_usage(uuid, int) to authenticated;
grant execute on function public.resolve_ai_analysis_usage(uuid, boolean) to authenticated;
