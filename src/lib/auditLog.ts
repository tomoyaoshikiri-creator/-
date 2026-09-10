import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditAction, Database, Json } from "@/lib/database.types";
import { logError } from "@/lib/logger";

// service_roleクライアント専用のヘルパー(B-3)。DB側のrecord_audit_event()
// (update_team_member/remove_team_member等のSECURITY DEFINER関数・トリガーの内部専用、
// authenticated/anonからは呼べない)とは別経路で、Route Handler側が既に持っている
// service_roleクライアントからaudit_logsへ直接書き込む。
//
// 監査ログの記録に失敗しても、呼び出し元の本来の操作(チーム退会・AI分析保存・
// 課金反映など)自体を失敗させたくないため、エラーはlogErrorに留めthrowしない。
export async function recordAuditEvent(
  adminClient: SupabaseClient<Database>,
  params: {
    teamId: string;
    actorId: string | null;
    action: AuditAction;
    targetType?: string;
    targetId?: string;
    detail?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await adminClient.from("audit_logs").insert({
    team_id: params.teamId,
    actor_id: params.actorId,
    action: params.action,
    target_type: params.targetType ?? null,
    target_id: params.targetId ?? null,
    detail: (params.detail ?? {}) as Json,
  });
  if (error) logError(`[auditLog] failed to record audit event (${params.action})`, error);
}
