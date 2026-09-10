begin;

-- Stripe Webhookの冪等化+処理履歴(A-3)。
-- statusで「記録してから処理」を安全に行う: idにevent.idを使いunique制約で
-- 同時到達した重複配信の後発側を弾く(claim)。処理が成功したらsucceeded、
-- 例外・DB更新失敗等でハンドラがエラーを返した場合はfailedのまま残し、
-- Stripeの再送(5xx応答時に自動的に行われる)で再処理できるようにする。
-- succeeded行のみを「処理済みなのでスキップしてよい」重複とみなす。
create table public.stripe_webhook_events (
  id text primary key, -- Stripe event id (evt_...)
  type text not null,
  payload_hash text not null,
  status text not null default 'processing' check (status in ('processing', 'succeeded', 'failed')),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

-- Webhook Route Handlerはservice_roleキーで書き込む(RLSを素通りする)。
-- anon/authenticatedからは一切アクセスさせないため、ポリシーを1つも作らずdenyのままにする。
alter table public.stripe_webhook_events enable row level security;

commit;
