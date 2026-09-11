begin;

-- 認証・招待系エンドポイントのアプリ側レート制限(C-2)。サインアップ・パスワード
-- 再設定要求・招待受諾には今までアプリ側の連投制限が無かった。CAPTCHA導入自体は
-- 外部サービスの鍵取得が必要(人間対応)だが、DBベースの簡易スライディングウィンドウ
-- 制限はコードだけで用意できる。0139(check_and_increment_push_notify_rate_limit)と
-- 同じ「Route Handler/Server Actionからservice_roleクライアント経由で呼ぶ
-- SECURITY DEFINER関数」の形を踏襲するが、event_type/keyを汎用化した1テーブルに
-- まとめ、複数のイベント種別(signup/forgot_password/invite_accept等)で使い回す。

create table public.rate_limit_events (
  id bigint generated always as identity primary key,
  event_type text not null,
  key text not null,
  created_at timestamptz not null default now()
);
create index rate_limit_events_lookup_idx on public.rate_limit_events(event_type, key, created_at);

alter table public.rate_limit_events enable row level security;
-- service_role専用(Server Action/Route Handlerからのみ読み書きする)。ポリシーは作らない。

-- 呼び出しのたびに、対象(event_type, key)の期限切れ行を削除してから直近件数を数え、
-- 上限未満なら1行追加してtrueを返す(スライディングウィンドウ)。期限切れ行の削除を
-- 呼び出し時に行うことで、別途クリーンアップ用のバッチを増やさずに済む。
create or replace function public.check_and_increment_rate_limit(
  p_event_type text, p_key text, p_window_seconds int, p_max_count int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  perform pg_advisory_xact_lock(hashtext(p_event_type || ':' || p_key));

  delete from public.rate_limit_events
    where event_type = p_event_type
      and key = p_key
      and created_at < now() - make_interval(secs => p_window_seconds);

  select count(*) into v_count
    from public.rate_limit_events
    where event_type = p_event_type and key = p_key;

  if v_count >= p_max_count then
    return false;
  end if;

  insert into public.rate_limit_events (event_type, key) values (p_event_type, p_key);
  return true;
end;
$$;

-- alter default privilegesによりauthenticated/anonにも自動でEXECUTEが付与されるため
-- (B-3で発覚した既知の罠、docs/runbook.md参照)、service_role以外は明示的に取り消す。
revoke execute on function public.check_and_increment_rate_limit(text, text, int, int) from public, authenticated, anon;
grant execute on function public.check_and_increment_rate_limit(text, text, int, int) to service_role;

commit;
