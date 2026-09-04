-- チーム目標(ホーム画面に表示する、シーズンの目標などの短いテキスト)。
-- 設定は管理者のみ(teams_update_by_admin、0002_team_theme.sqlで定義済み)で追加のRLS変更は不要。
-- 未設定(null)の場合はホーム画面に何も表示しない。
alter table public.teams add column team_goal text;
