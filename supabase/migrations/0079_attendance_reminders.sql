-- 出欠登録リマインドのプッシュ通知に必要なスキーマ。
-- 試合・イベントは任意で「出欠登録の期限日」を設定できる(未設定でも予定日2日前の
-- 共通リマインドでカバーされる。設定した場合のみ、期限日当日・期限超過後の
-- 1週間前リマインドが追加で発火する)。
alter table public.schedules add column attendance_deadline date;

-- 同じ予定・同じ種類のリマインドを二重送信しないためのログ。
-- Vercel Cron(service_roleキー)からのみ書き込む内部テーブルのため、RLSは有効化のみ行い
-- ポリシーは持たせない(service_roleはRLSをバイパスするため、通常ユーザーからは一切
-- 参照・書き込みできない)。
create table public.attendance_reminder_log (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('baseline_2days', 'deadline_day', 'week_before')),
  sent_at timestamptz not null default now(),
  unique (schedule_id, reminder_type)
);

alter table public.attendance_reminder_log enable row level security;
