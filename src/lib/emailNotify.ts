import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, EmailNotificationEvent } from "@/lib/database.types";
import { sendEmail } from "@/lib/email";
import { logError } from "@/lib/logger";

// service_roleクライアント専用(B-4)。メール送信を試み、結果をemail_notificationsへ
// 記録する。subject/html_bodyをそのまま保存しておくことで、失敗時は
// retryFailedEmailNotifications()がイベント種別ごとの文面組み立てロジックを
// 再実行せずにそのまま再送できる。
export async function sendTrackedEmail(
  adminClient: SupabaseClient<Database>,
  params: { teamId: string; recipientEmail: string; eventType: EmailNotificationEvent; subject: string; html: string },
): Promise<boolean> {
  const result = await sendEmail({ to: params.recipientEmail, subject: params.subject, html: params.html });
  const { error } = await adminClient.from("email_notifications").insert({
    team_id: params.teamId,
    recipient_email: params.recipientEmail,
    event_type: params.eventType,
    subject: params.subject,
    html_body: params.html,
    status: result.success ? "sent" : "failed",
    resend_message_id: result.success ? (result.messageId ?? null) : null,
    last_error: result.success ? null : result.error,
  });
  if (error) logError(`[emailNotify] failed to record email notification (${params.eventType})`, error);
  return result.success;
}

// チーム退会(完全削除)申請時に、そのチームの全メンバーへ予告メールを送る(B-4)。
// team/request-deletion・account/request-deletion両方のRoute Handlerから呼ぶため、
// ここに共通化する。
export async function notifyTeamDeletionWarning(
  adminClient: SupabaseClient<Database>,
  params: { teamId: string; teamName: string },
): Promise<void> {
  const { data: members } = await adminClient.from("team_memberships").select("user_id").eq("team_id", params.teamId);
  const memberIds = (members ?? []).map((m) => m.user_id);
  if (memberIds.length === 0) return;
  const { data: profiles } = await adminClient.from("profiles").select("id, email").in("id", memberIds);
  await Promise.all(
    (profiles ?? [])
      .filter((p): p is { id: string; email: string } => !!p.email)
      .map((p) =>
        sendTrackedEmail(adminClient, {
          teamId: params.teamId,
          recipientEmail: p.email,
          eventType: "team_deletion_warning",
          subject: "【CIRCLE LINES】チーム退会(完全削除)のお知らせ",
          html: `<p>チーム「${params.teamName}」の退会(完全削除)が申請されました。7日後にすべてのデータが完全に削除されます。心当たりがない場合や取り消したい場合は、チームの管理者にご確認ください。</p>`,
        }),
      ),
  );
}

// 失敗したメール通知を再送する(B-4)。日次cron(attendance-reminders)から呼ぶ想定。
// 3回失敗したものは以降対象から外れる(email_notifications_retry_idx参照)。
export async function retryFailedEmailNotifications(adminClient: SupabaseClient<Database>): Promise<number> {
  const { data: failed, error: selectError } = await adminClient
    .from("email_notifications")
    .select("id, recipient_email, subject, html_body, attempt_count")
    .eq("status", "failed")
    .lt("attempt_count", 3);
  if (selectError) {
    logError("[emailNotify] failed to load failed email notifications for retry", selectError);
    return 0;
  }

  let recovered = 0;
  for (const row of failed ?? []) {
    const result = await sendEmail({ to: row.recipient_email, subject: row.subject, html: row.html_body });
    if (result.success) recovered += 1;
    const { error: updateError } = await adminClient
      .from("email_notifications")
      .update({
        status: result.success ? "sent" : "failed",
        resend_message_id: result.success ? (result.messageId ?? null) : null,
        last_error: result.success ? null : result.error,
        attempt_count: row.attempt_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (updateError) logError("[emailNotify] failed to update email notification after retry", updateError);
  }
  return recovered;
}
