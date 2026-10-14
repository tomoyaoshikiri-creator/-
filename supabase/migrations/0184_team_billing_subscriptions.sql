begin;

-- 課金権限の一元管理(ユーザー指示 項目4)。iOS・Android・Webのどこで契約しても
-- 同じteams.planに反映されるようにするための土台。teams.planは今まで通り
-- 「実際に有効な権限」を表す唯一の真実のまま残し、このテーブルは
-- 「どの決済経路(Stripe/Apple/Google)からの契約が今有効か」を記録する。
-- Apple/Google向けのwebhook受け口自体は、ネイティブアプリ実装時に別途追加する。
-- このテーブルはservice_role専用(webhookからのみ書き込む)で、クライアント向けの
-- ポリシーは一切設けない(stripe_webhook_eventsと同じ方針)。
create table public.team_billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  platform text not null check (platform in ('stripe', 'apple', 'google')),
  -- Stripeのsubscription ID / Appleのoriginal transaction ID / Googleのpurchase token。
  external_subscription_id text not null,
  plan text not null check (plan in ('お試し', '中間', 'フル', 'フルプラス')),
  status text not null check (status in ('active', 'canceled')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, external_subscription_id)
);
create index team_billing_subscriptions_team_id_idx on public.team_billing_subscriptions(team_id, status);

alter table public.team_billing_subscriptions enable row level security;

commit;
