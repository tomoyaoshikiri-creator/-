-- 選手の誕生日プッシュ通知に必要なスキーマ。
-- 同じ選手・同じ日に二重送信しないためのログ。attendance_reminder_logと同じ考え方で、
-- Vercel Cron(service_roleキー)からのみ書き込む内部テーブルのため、RLSは有効化のみ行い
-- ポリシーは持たせない(service_roleはRLSをバイパスするため、通常ユーザーからは一切
-- 参照・書き込みできない)。
create table public.birthday_reminder_log (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  notified_date date not null,
  sent_at timestamptz not null default now(),
  unique (player_id, notified_date)
);

alter table public.birthday_reminder_log enable row level security;
