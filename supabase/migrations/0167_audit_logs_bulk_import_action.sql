begin;

-- 選手のCSV一括登録(M-1、Max限定)を監査ログに記録できるようにaudit_logs.actionの
-- CHECK制約にplayers_bulk_importedを追加する(0141_audit_logs.sqlの再定義)。
-- 件数のみを記録し、選手名等の個人情報はdetailに含めない(docs記載の方針通り)。

alter table public.audit_logs drop constraint audit_logs_action_check;
alter table public.audit_logs add constraint audit_logs_action_check check (action in (
  'role_changed',
  'invite_issued',
  'invite_revoked',
  'member_removed',
  'team_leave',
  'team_deletion_requested',
  'ai_analysis_generated',
  'billing_plan_changed',
  'billing_subscription_canceled',
  'data_export',
  'players_bulk_imported'
));

commit;
