-- 日報・選手分析フィードバック(チーム/個人)の「編集」も新着通知の対象にするため、
-- 更新日時を追加する(player_notesと同じ理由。0061参照)。
alter table public.reports add column updated_at timestamptz not null default now();
alter table public.team_analysis_notes add column updated_at timestamptz not null default now();
alter table public.player_analysis_notes add column updated_at timestamptz not null default now();
