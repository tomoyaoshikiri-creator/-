begin;

-- 重要通知のメールフォールバック(B-4)。招待・出欠締切・請求失敗・チーム退会予告を
-- Resendでメール送信した記録。配送状態(sent/failed)と再送回数を保持し、
-- 失敗分は日次cron(attendance-reminders)から再送する。
-- subject/html_bodyをそのまま保存しておくことで、再送時にイベント種別ごとの
-- 文面組み立てロジックを再実行しなくて済むようにしている。

create table public.email_notifications (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  recipient_email text not null,
  event_type text not null check (event_type in (
    'invite_issued',
    'attendance_deadline',
    'billing_payment_failed',
    'team_deletion_warning'
  )),
  subject text not null,
  html_body text not null,
  status text not null check (status in ('sent', 'failed')),
  resend_message_id text,
  last_error text,
  attempt_count int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index email_notifications_team_id_created_at_idx on public.email_notifications(team_id, created_at desc);
-- 再送対象(失敗・3回未満)の抽出専用の部分インデックス。
create index email_notifications_retry_idx on public.email_notifications(attempt_count) where status = 'failed';

alter table public.email_notifications enable row level security;

-- 閲覧は自チームの管理者のみ。書き込みはすべてRoute Handler/cronのservice_role
-- クライアントから直接行う想定のため、authenticated/anon向けのINSERT/UPDATE/DELETE
-- ポリシーは作らない(record_audit_event等と同じ、書き込み経路を絞る方針)。
create policy email_notifications_select on public.email_notifications for select
  using (team_id = public.current_team_id() and public.current_role() = '管理者');

commit;
