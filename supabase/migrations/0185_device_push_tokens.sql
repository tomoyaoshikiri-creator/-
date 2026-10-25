begin;

-- ネイティブアプリ(iOS/Android)向けPush通知の土台(ユーザー指示 項目5)。
-- Apple/Google双方の「Webを包んだだけ」判定(Guideline 4.2 / Spam and Minimum
-- Functionality Policy)を避けるため、ネイティブPush通知が必要になる。
-- 今のWeb Push(push_subscriptions、endpoint/p256dh/auth_key)とは鍵の形が
-- 全く異なる(APNs/FCMはデバイストークン1本)ため、同じテーブルを無理に
-- 使い回さず別テーブルにする。RLSはpush_subscriptionsと同じ方針
-- (本人の行のみ閲覧・登録・削除可)。
create table public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, token)
);
create index device_push_tokens_user_id_idx on public.device_push_tokens(user_id);
create index device_push_tokens_team_id_idx on public.device_push_tokens(team_id);

alter table public.device_push_tokens enable row level security;

create policy device_push_tokens_select on public.device_push_tokens for select
  using (user_id = (select auth.uid()));
create policy device_push_tokens_insert on public.device_push_tokens for insert
  with check (user_id = (select auth.uid()) and team_id = public.current_team_id());
create policy device_push_tokens_delete on public.device_push_tokens for delete
  using (user_id = (select auth.uid()));

commit;
