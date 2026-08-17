import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { playerFullName } from "@/lib/format";
import type { Database } from "@/lib/database.types";

// 選手の誕生日プッシュ通知。全チーム横断で、今日が誕生日の在籍選手を洗い出し、
// チーム全員(保護者・指導者・管理者)にお祝いのプッシュ通知を送る。同じ選手・同じ日に
// 二重送信しないよう、birthday_reminder_logで管理する。
// Vercel Cronのジョブ数を増やさないため、専用のcronは作らず/api/cron/attendance-remindersの
// 日次バッチから呼び出す(webpushの鍵設定は呼び出し元で済んでいる前提)。
export async function runBirthdayReminders(
  supabase: SupabaseClient<Database>,
  todayStr: string,
): Promise<{ players: number; processed: number; results: { playerId: string; sent: number }[] }> {
  const monthDay = todayStr.slice(5, 10); // "MM-DD"

  const { data: players } = await supabase
    .from("players")
    .select("*")
    .eq("status", "在籍")
    .not("birthday", "is", null);

  const birthdayPlayers = (players ?? []).filter((p) => p.birthday && p.birthday.slice(5, 10) === monthDay);
  if (birthdayPlayers.length === 0) {
    return { players: 0, processed: 0, results: [] };
  }

  const { data: existingLogs } = await supabase
    .from("birthday_reminder_log")
    .select("player_id")
    .eq("notified_date", todayStr)
    .in(
      "player_id",
      birthdayPlayers.map((p) => p.id),
    );
  const alreadySent = new Set((existingLogs ?? []).map((l) => l.player_id));
  const pendingPlayers = birthdayPlayers.filter((p) => !alreadySent.has(p.id));

  const results: { playerId: string; sent: number }[] = [];

  for (const player of pendingPlayers) {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_key")
      .eq("team_id", player.team_id);

    const title = "🎂 誕生日おめでとう!";
    const body = `今日は${playerFullName(player)}選手の誕生日です。みんなでお祝いしましょう!`;
    const payload = JSON.stringify({ title, body, url: `/players/${player.id}` });

    let sent = 0;
    await Promise.all(
      (subs ?? []).map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } }, payload);
          sent += 1;
        } catch (err) {
          const statusCode = (err as { statusCode?: number } | null)?.statusCode;
          console.error(`[cron/birthdays] send failed (subscription ${s.id}, status ${statusCode})`, err);
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", s.id);
          }
        }
      }),
    );

    results.push({ playerId: player.id, sent });
    await supabase.from("birthday_reminder_log").insert({ player_id: player.id, notified_date: todayStr });
  }

  return { players: birthdayPlayers.length, processed: pendingPlayers.length, results };
}
