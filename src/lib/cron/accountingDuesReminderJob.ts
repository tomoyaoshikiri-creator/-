import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { sendTrackedEmail } from "@/lib/emailNotify";
import { duesPeriodLabel } from "@/lib/accountingDues";
import { formatYen, type DuesBillingUnit } from "@/lib/accounting";
import { logError } from "@/lib/logger";
import { sendNativePush } from "@/lib/nativePush";
import type { Database } from "@/lib/database.types";

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// 未納の家庭へ、集金項目ごとに設定された日数(reminder_days_after)を過ぎても
// 未納のままの請求を通知する。Vercel Cronのジョブ数を増やさないため、専用cronは
// 作らず/api/cron/attendance-remindersの日次バッチから呼び出す
// (runDuesGenerationと同じ方針)。
// 「家庭ごと」請求はgroup_key(保護者profile_id)、「選手ごと」請求はgroup_key=player_idの
// 単位でまとめ、同じ保護者に子ども分の通知が何件も届かないようにする。
// 送信済みかどうかはaccounting_dues_charges.reminder_sent_atで管理し、二重送信を防ぐ。
export async function runDuesReminders(
  supabase: SupabaseClient<Database>,
  todayStr: string,
): Promise<{ groupsNotified: number; chargesMarked: number }> {
  const { data: items } = await supabase
    .from("accounting_dues_items")
    .select("id, team_id, name, billing_unit, reminder_days_after")
    .eq("active", true)
    .not("reminder_days_after", "is", null);
  if (!items || items.length === 0) return { groupsNotified: 0, chargesMarked: 0 };

  let groupsNotified = 0;
  let chargesMarked = 0;

  for (const item of items) {
    const reminderDays = item.reminder_days_after;
    if (reminderDays === null) continue;

    const { data: periods } = await supabase
      .from("accounting_dues_billing_periods")
      .select("id, period_start, period_end")
      .eq("dues_item_id", item.id);
    const duePeriods = (periods ?? []).filter((p) => addDaysStr(p.period_start, reminderDays) <= todayStr);
    if (duePeriods.length === 0) continue;

    const periodIds = duePeriods.map((p) => p.id);
    const { data: charges } = await supabase
      .from("accounting_dues_charges")
      .select("id, billing_period_id, player_id, group_key, amount")
      .in("billing_period_id", periodIds)
      .eq("status", "unpaid")
      .is("reminder_sent_at", null);
    if (!charges || charges.length === 0) continue;

    const byGroup = new Map<string, typeof charges>();
    for (const c of charges) {
      const key = `${c.billing_period_id}:${c.group_key}`;
      const arr = byGroup.get(key) ?? [];
      arr.push(c);
      byGroup.set(key, arr);
    }

    for (const groupCharges of byGroup.values()) {
      const period = duePeriods.find((p) => p.id === groupCharges[0].billing_period_id);
      if (!period) continue;
      const totalAmount = groupCharges.reduce((sum, c) => sum + Number(c.amount), 0);

      let recipientProfileIds: string[];
      if ((item.billing_unit as DuesBillingUnit) === "household") {
        recipientProfileIds = [groupCharges[0].group_key];
      } else {
        const { data: links } = await supabase
          .from("player_guardians")
          .select("profile_id")
          .eq("player_id", groupCharges[0].group_key);
        recipientProfileIds = [...new Set((links ?? []).map((l) => l.profile_id))];
      }
      if (recipientProfileIds.length === 0) continue;

      const title = "💰 未納のお知らせ";
      const body = `${item.name}(${duesPeriodLabel({ periodStart: period.period_start, periodEnd: period.period_end })})が未納です(${formatYen(totalAmount)})`;
      const url = `/players/${groupCharges[0].player_id}/dues`;
      await sendDuesReminder(supabase, item.team_id, recipientProfileIds, title, body, url);
      groupsNotified += 1;

      const { error } = await supabase
        .from("accounting_dues_charges")
        .update({ reminder_sent_at: new Date().toISOString() })
        .in(
          "id",
          groupCharges.map((c) => c.id),
        );
      if (!error) chargesMarked += groupCharges.length;
    }
  }

  return { groupsNotified, chargesMarked };
}

async function sendDuesReminder(
  supabase: SupabaseClient<Database>,
  teamId: string,
  profileIds: string[],
  title: string,
  body: string,
  url: string,
): Promise<void> {
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth_key")
    .in("user_id", profileIds);

  await Promise.all(
    (subs ?? []).map(async (s) => {
      const payload = JSON.stringify({ title, body, url });
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } }, payload);
      } catch (err) {
        const statusCode = (err as { statusCode?: number } | null)?.statusCode;
        logError(`[cron/dues-reminders] send failed (subscription ${s.id}, status ${statusCode})`, err);
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", s.id);
        }
      }
    }),
  );

  await sendNativePush(supabase, profileIds, { title, body, url });

  // メールフォールバック(B-4)。push購読を1件も持たないユーザーにだけ送る。
  const pushedUserIds = new Set((subs ?? []).map((s) => s.user_id));
  const fallbackUserIds = profileIds.filter((id) => !pushedUserIds.has(id));
  if (fallbackUserIds.length === 0) return;

  const { data: profiles } = await supabase.from("profiles").select("id, email").in("id", fallbackUserIds);
  const siteUrl = process.env.SITE_URL;
  const link = siteUrl ? `<p><a href="${siteUrl}${url}">アプリを開く</a></p>` : "";
  await Promise.all(
    (profiles ?? [])
      .filter((p): p is { id: string; email: string } => !!p.email)
      .map((p) =>
        sendTrackedEmail(supabase, {
          teamId,
          recipientEmail: p.email,
          eventType: "dues_unpaid_reminder",
          subject: `【CIRCLE LINES】${title}`,
          html: `<p>${body}</p>${link}`,
        }),
      ),
  );
}
