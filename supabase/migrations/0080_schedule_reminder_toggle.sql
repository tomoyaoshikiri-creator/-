-- 予定ごとに出欠登録リマインドの送信有無を選べるようにする(既定はON、全種別対象)。
alter table public.schedules add column send_attendance_reminders boolean not null default true;
