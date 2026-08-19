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
-- - 予約から10分経過してもreservedのままの行は、クラッシュ等でresolveされなかった
--   ものとみなし、利用回数の集計から自動的に除外する(枠を自動的に解放する)。
-- - team_id + request_id にunique制約を付け、同一リクエスト(クライアント側で生成した
--   冪等キー)の再送があっても二重に予約・二重カウントされないようにする。
-- - team_id + year_month(JST基準)ごとにpg_advisory_xact_lockでロックしたうえで
--   件数確認とINSERTを行うため、同時リクエストでも上限を超えて予約されることがない。
--
-- セキュリティ方針(重要): AI利用回数はプランの利用制限に直結するため、ブラウザから
-- 直接カウントを操作できてはならない。
-- - reserve_ai_analysis_usage/resolve_ai_analysis_usageは、api/ai-analysis/route.ts側で
--   既にrole('管理者')・プラン(hasAiAnalysisAccess)・競技対応を検証済みの後にのみ
--   呼び出す前提とし、team_id/actor_idをRPCの引数として明示的に受け取る(current_team_id()
--   のようなauth.uid()依存のヘルパーには頼らない)。そのうえでPostgreSQLの関数は
--   デフォルトでPUBLICにEXECUTE権限が付与される仕様があるため、明示的に
--   REVOKE EXECUTE ... FROM PUBLICしたうえでservice_roleにのみGRANTし、
--   ブラウザが使うanon/authenticatedロールからは直接呼び出せないようにする
--   (Next.jsのAPI RouteがSUPABASE_SERVICE_ROLE_KEYで作るクライアント経由でのみ呼べる)。
-- - get_ai_analysis_usage()は引数を取らずauth.uid()から自チームのcurrent_team_id()を
--   導出するだけなので、authenticatedに直接呼ばせても他チームの情報は取得できない
--   (team_idを差し替えて他チームを読む余地がない)。読み取り専用のため許可する。
-- - ai_analysis_usage_count(p_team_id, ...)はp_team_idを任意に指定できてしまうため、
--   authenticated/anonには一切許可しない内部専用ヘルパーとする(SECURITY DEFINER
--   関数同士の呼び出しはオーナー権限で実行されるため、他関数からの呼び出し自体には
--   GRANTは不要)。

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
-- = RLS有効時はデフォルトで拒否される)。
create policy ai_analysis_usage_select on public.ai_analysis_usage for select
  using (team_id = public.current_team_id() and public.current_role() in ('指導者', '管理者'));

-- 内部専用ヘルパー(authenticated/anonへは一切許可しない。他のSECURITY DEFINER関数から
-- 呼び出す場合はオーナー権限で実行されるため個別のGRANTは不要)。p_team_idを外部から
-- 任意に指定できてしまうため、直接公開すると他チームの利用回数が読めてしまう。
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
-- 引数を取らずauth.uid()からteam_idを導出するため、他チームの値を読み取ることはできない。
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
--
-- p_team_id/p_actor_idは、呼び出し元(api/ai-analysis/route.ts)が既に通常のRLS
-- クライアントでrole('管理者')・プラン・競技対応を検証済みの認証ユーザーについて
-- 取得した値を渡す前提。この関数自体はservice_roleからのみ実行可能にする
-- (下部のREVOKE/GRANTを参照)。
create or replace function public.reserve_ai_analysis_usage(
  p_team_id uuid,
  p_actor_id uuid,
  p_request_id uuid,
  p_monthly_limit int
)
returns table (reservation_id uuid, usage_status text, used_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year_month text := to_char(now() at time zone 'Asia/Tokyo', 'YYYY-MM');
  v_existing public.ai_analysis_usage;
  v_count int;
  v_new_id uuid;
begin
  if p_team_id is null then
    raise exception 'TEAM_ID_REQUIRED' using errcode = '22004';
  end if;

  -- 同一チーム・同一月内の予約処理を直列化する(同時リクエストでも上限を超えない)。
  -- トランザクション終了時に自動的に解放される。
  perform pg_advisory_xact_lock(hashtextextended(p_team_id::text || ':' || v_year_month, 0));

  select * into v_existing from public.ai_analysis_usage
    where team_id = p_team_id and request_id = p_request_id;
  if found then
    -- 同一リクエストの再送: 新たに予約を作らず、既存の状態をそのまま返す
    -- (二重カウントを防ぐ)。stale(10分超のreserved)であっても、この行自体は
    -- 「同一リクエストの再送」として扱い、新しい予約を別途作らない。
    return query select v_existing.id, v_existing.status, public.ai_analysis_usage_count(p_team_id, v_year_month);
    return;
  end if;

  v_count := public.ai_analysis_usage_count(p_team_id, v_year_month);
  if v_count >= p_monthly_limit then
    raise exception 'AI_USAGE_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  insert into public.ai_analysis_usage (team_id, year_month, request_id, status, created_by)
  values (p_team_id, v_year_month, p_request_id, 'reserved', p_actor_id)
  returning id into v_new_id;

  return query select v_new_id, 'reserved'::text, v_count + 1;
end;
$$;

-- 予約(reserve_ai_analysis_usage)の結果を確定する。p_succeeded=trueで生成成功・
-- 保存完了、falseで生成失敗(枠を消費しない)。reserve_ai_analysis_usageと同じく
-- service_roleからのみ実行可能にする。p_team_idと一致する行のみを更新するため、
-- 万一reservation_idが推測されても他チームの行は更新できない。
create or replace function public.resolve_ai_analysis_usage(
  p_team_id uuid,
  p_reservation_id uuid,
  p_succeeded boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ai_analysis_usage
  set status = case when p_succeeded then 'succeeded' else 'failed' end,
      resolved_at = now()
  where id = p_reservation_id
    and team_id = p_team_id
    and status = 'reserved';
end;
$$;

-- PostgreSQLは関数作成時にデフォルトでPUBLICにEXECUTE権限を付与するため、明示的に
-- 剥奪したうえで必要なロールにのみ付与し直す。
revoke execute on function public.ai_analysis_usage_count(uuid, text) from public;
revoke execute on function public.get_ai_analysis_usage() from public;
revoke execute on function public.reserve_ai_analysis_usage(uuid, uuid, uuid, int) from public;
revoke execute on function public.resolve_ai_analysis_usage(uuid, uuid, boolean) from public;

-- 読み取り専用で他チームの情報が漏れないget_ai_analysis_usageのみブラウザから直接許可する。
grant execute on function public.get_ai_analysis_usage() to authenticated;

-- 利用回数を実際に変更するreserve/resolveはservice_role(Next.jsのAPI Route)からのみ
-- 実行可能にする。ai_analysis_usage_countはservice_roleにも個別付与しない
-- (get_ai_analysis_usage/reserve_ai_analysis_usageの内部呼び出しはオーナー権限で
-- 実行されるため、これらのSECURITY DEFINER関数からは呼び出せる)。
grant execute on function public.reserve_ai_analysis_usage(uuid, uuid, uuid, int) to service_role;
grant execute on function public.resolve_ai_analysis_usage(uuid, uuid, boolean) to service_role;

-- 既存のAI分析生成履歴(player_analysis_notes/team_analysis_notesのsource='ai')を、
-- 当月(JST基準)分のみバックフィルする。過去の月は当月の利用回数集計に影響しない
-- ため対象外とする。1件のnoteにつき1回の利用として扱い、決定的なrequest_id
-- (note idから導出、md5ハッシュの32桁16進文字列はそのままuuid型として解釈できる)
-- を使うことで、このmigrationを誤って複数回実行しても重複INSERTされない
-- (team_id+request_idのunique制約により2回目以降はon conflict do nothingでスキップ)。
insert into public.ai_analysis_usage (team_id, year_month, request_id, status, reserved_at, resolved_at, created_by)
select
  team_id,
  to_char(created_at at time zone 'Asia/Tokyo', 'YYYY-MM'),
  md5('legacy-player-' || id::text)::uuid,
  'succeeded',
  created_at,
  created_at,
  author_id
from public.player_analysis_notes
where source = 'ai'
  and to_char(created_at at time zone 'Asia/Tokyo', 'YYYY-MM') = to_char(now() at time zone 'Asia/Tokyo', 'YYYY-MM')
on conflict (team_id, request_id) do nothing;

insert into public.ai_analysis_usage (team_id, year_month, request_id, status, reserved_at, resolved_at, created_by)
select
  team_id,
  to_char(created_at at time zone 'Asia/Tokyo', 'YYYY-MM'),
  md5('legacy-team-' || id::text)::uuid,
  'succeeded',
  created_at,
  created_at,
  author_id
from public.team_analysis_notes
where source = 'ai'
  and to_char(created_at at time zone 'Asia/Tokyo', 'YYYY-MM') = to_char(now() at time zone 'Asia/Tokyo', 'YYYY-MM')
on conflict (team_id, request_id) do nothing;
