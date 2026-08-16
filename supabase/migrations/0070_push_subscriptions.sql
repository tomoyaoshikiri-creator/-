-- Web Push通知の購読情報。ブラウザのPush APIから発行されるendpoint/鍵を保存し、
-- サーバー側(service_roleキー使用のRoute Handler)からのみ全件を読み出して送信する。
-- 本人以外は自分の購読情報を読めないようSELECTはuser_id=auth.uid()に限定する。
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_select on public.push_subscriptions for select
  using (user_id = auth.uid());

create policy push_subscriptions_insert on public.push_subscriptions for insert
  with check (user_id = auth.uid() and team_id = public.current_team_id());

create policy push_subscriptions_delete on public.push_subscriptions for delete
  using (user_id = auth.uid());
