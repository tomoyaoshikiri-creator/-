import type { AuditAction } from "@/lib/database.types";

// 監査ログ画面(/settings/audit-log)とCSV出力(M-3、/api/audit-log/export)の両方から
// 参照する表示用の定義。detailに入れる値自体は常に必要最小限(auditLog.ts参照)で、
// メールアドレス等の個人情報は含めない方針のため、ここで組み立てる表示文もその範囲に留める。
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  role_changed: "ロール変更",
  invite_issued: "招待を発行",
  invite_revoked: "招待を取消",
  member_removed: "メンバーを削除",
  team_leave: "チームを脱退",
  team_deletion_requested: "チーム退会(完全削除)を申請",
  ai_analysis_generated: "AI分析を生成",
  billing_plan_changed: "プランが変更",
  billing_subscription_canceled: "サブスクリプションが解約",
  data_export: "データをエクスポート",
  players_bulk_imported: "選手をCSV一括登録",
  poll_voter_identity_viewed: "投票者名を特例で閲覧",
};

export function describeAuditDetail(action: AuditAction, detail: unknown): string | null {
  const d = (detail ?? {}) as Record<string, unknown>;
  switch (action) {
    case "role_changed":
      return typeof d.from_role === "string" && typeof d.to_role === "string" ? `${d.from_role} → ${d.to_role}` : null;
    case "invite_issued":
    case "invite_revoked":
      return typeof d.role === "string" ? `${d.role}向け招待` : null;
    case "member_removed":
      return typeof d.target_name === "string" ? d.target_name : null;
    case "ai_analysis_generated":
      return d.scope === "player" ? "選手分析" : d.scope === "team" ? "チーム分析" : null;
    case "billing_plan_changed":
      return typeof d.plan === "string" ? `${d.plan}(${d.subscription_status ?? "-"})` : null;
    case "players_bulk_imported":
      return typeof d.imported === "number" ? `${d.imported}件登録(対象${d.total ?? "-"}件)` : null;
    default:
      return null;
  }
}
