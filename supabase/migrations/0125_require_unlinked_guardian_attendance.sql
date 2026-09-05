-- 選手に紐づいていない一般・運営メンバーにも「自分」名義の出欠登録を求めるかどうかの
-- チーム単位のON/OFF設定。デフォルトtrue(既存の挙動を維持)。
-- 対象は/schedule/[id]/page.tsx(出欠フォーム表示)・src/lib/homeData.ts(ホームの
-- 「要対応」カード)・src/app/api/cron/attendance-reminders/route.ts(出欠リマインド通知)の
-- 3箇所で、いずれも「紐づく選手が1人もいない一般・運営メンバー」だけに影響する
-- (指導者・管理者自身の「本人」出欠、選手に紐づく保護者の出欠には影響しない)。
-- 設定は管理者のみ(teams_update_by_admin、0002_team_theme.sqlで定義済み)で
-- 追加のRLS変更は不要。
alter table public.teams
  add column require_unlinked_guardian_attendance boolean not null default true;
