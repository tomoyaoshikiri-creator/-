import { NextResponse } from "next/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";
import { recordAuditEvent } from "@/lib/auditLog";
import type { Database, ScheduleType } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  practice: "練習",
  game: "試合",
  event: "イベント",
  other: "その他",
};

type ExportType = "players" | "schedules" | "attendances" | "games" | "daily_reports" | "notices";
const EXPORT_TYPES: ExportType[] = ["players", "schedules", "attendances", "games", "daily_reports", "notices"];

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function profileNameMap(supabase: SupabaseServerClient, ids: (string | null)[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(ids.filter((id): id is string => !!id))];
  if (uniqueIds.length === 0) return new Map();
  const { data } = await supabase.from("profiles").select("id, name").in("id", uniqueIds);
  return new Map((data ?? []).map((p) => [p.id, p.name]));
}

async function scheduleMap(
  supabase: SupabaseServerClient,
  teamId: string,
): Promise<Map<string, { title: string; date: string }>> {
  const { data } = await supabase.from("schedules").select("id, title, date").eq("team_id", teamId);
  return new Map((data ?? []).map((s) => [s.id, { title: s.title, date: s.date }]));
}

// 各エクスポート種別のCSV本体を生成する。RLSが効くユーザークライアント(current_team_id()
// スコープ)だけを使い、service_roleは使わない(閲覧できるのは自分のチームのデータのみ)。
async function buildCsv(type: ExportType, supabase: SupabaseServerClient, teamId: string): Promise<string> {
  switch (type) {
    case "players": {
      const { data } = await supabase
        .from("players")
        .select("sei, mei, sei_kana, mei_kana, grade, number, positions, status, birthday, birthday_visible, created_at")
        .eq("team_id", teamId)
        .order("created_at");
      const rows = (data ?? []).map((p) => [
        p.sei,
        p.mei,
        p.sei_kana,
        p.mei_kana,
        p.grade,
        p.number,
        p.positions.join("・"),
        p.status,
        p.birthday,
        p.birthday_visible ? "はい" : "いいえ",
        p.created_at,
      ]);
      return toCsv(
        ["姓", "名", "姓(カナ)", "名(カナ)", "学年", "背番号", "ポジション", "在籍状況", "生年月日", "生年月日公開", "登録日"],
        rows,
      );
    }
    case "schedules": {
      const { data } = await supabase
        .from("schedules")
        .select(
          "type, title, date, start_time, end_time, place, toban, target_grade_min, game_category, venue_type, attendance_deadline, created_at",
        )
        .eq("team_id", teamId)
        .order("date");
      const rows = (data ?? []).map((s) => [
        SCHEDULE_TYPE_LABELS[s.type],
        s.title,
        s.date,
        s.start_time,
        s.end_time,
        s.place,
        s.toban,
        s.target_grade_min,
        s.game_category,
        s.venue_type,
        s.attendance_deadline,
        s.created_at,
      ]);
      return toCsv(
        ["種別", "タイトル", "日付", "開始", "終了", "場所", "当番", "対象学年下限", "試合区分", "会場種別", "出欠締切", "作成日"],
        rows,
      );
    }
    case "attendances": {
      const schedules = await scheduleMap(supabase, teamId);
      const scheduleIds = [...schedules.keys()];
      if (scheduleIds.length === 0) return toCsv(["予定タイトル", "予定日", "選手名", "出欠状況", "同行", "同行人数", "車", "座席数", "備考", "更新日"], []);
      const { data } = await supabase
        .from("attendances")
        .select("schedule_id, player_id, status, accompany, accompany_count, car, seats, note, updated_at")
        .in("schedule_id", scheduleIds);
      const players = await profileNameMapForPlayers(supabase, teamId, (data ?? []).map((a) => a.player_id));
      const rows = (data ?? []).map((a) => {
        const schedule = schedules.get(a.schedule_id);
        return [
          schedule?.title ?? "",
          schedule?.date ?? "",
          a.player_id ? (players.get(a.player_id) ?? "") : "",
          a.status,
          a.accompany,
          a.accompany_count,
          a.car,
          a.seats,
          a.note,
          a.updated_at,
        ];
      });
      return toCsv(["予定タイトル", "予定日", "選手名", "出欠状況", "同行", "同行人数", "車", "座席数", "備考", "更新日"], rows);
    }
    case "games": {
      const schedules = await scheduleMap(supabase, teamId);
      const { data } = await supabase
        .from("game_matches")
        .select("schedule_id, game_number, opponent, team_score, opponent_score, created_at")
        .eq("team_id", teamId)
        .order("created_at");
      const rows = (data ?? []).map((g) => {
        const schedule = schedules.get(g.schedule_id);
        return [
          schedule?.title ?? "",
          schedule?.date ?? "",
          g.game_number,
          g.opponent,
          g.team_score,
          g.opponent_score,
          g.created_at,
        ];
      });
      return toCsv(["予定タイトル", "予定日", "第N試合", "対戦相手", "自チーム得点", "相手得点", "作成日"], rows);
    }
    case "daily_reports": {
      const { data } = await supabase
        .from("daily_reports")
        .select("author_id, date, body, created_at, updated_at")
        .eq("team_id", teamId)
        .order("date");
      const authors = await profileNameMap(supabase, (data ?? []).map((r) => r.author_id));
      const rows = (data ?? []).map((r) => [
        r.author_id ? (authors.get(r.author_id) ?? "") : "",
        r.date,
        r.body,
        r.created_at,
        r.updated_at,
      ]);
      return toCsv(["作成者", "日付", "本文", "作成日", "更新日"], rows);
    }
    case "notices": {
      const { data } = await supabase
        .from("notices")
        .select("title, body, sender_id, audience, target_grade_min, created_at")
        .eq("team_id", teamId)
        .order("created_at");
      const senders = await profileNameMap(supabase, (data ?? []).map((n) => n.sender_id));
      const rows = (data ?? []).map((n) => [
        n.title,
        n.body,
        n.sender_id ? (senders.get(n.sender_id) ?? "") : "",
        n.audience,
        n.target_grade_min,
        n.created_at,
      ]);
      return toCsv(["タイトル", "本文", "送信者", "対象", "対象学年下限", "作成日"], rows);
    }
  }
}

// attendances.player_idはprofilesではなくplayersを指すため、profileNameMapとは別に
// players.sei/meiから氏名を組み立てる専用のヘルパーが必要。
async function profileNameMapForPlayers(
  supabase: SupabaseServerClient,
  teamId: string,
  ids: (string | null)[],
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(ids.filter((id): id is string => !!id))];
  if (uniqueIds.length === 0) return new Map();
  const { data } = await supabase.from("players").select("id, sei, mei").eq("team_id", teamId).in("id", uniqueIds);
  return new Map((data ?? []).map((p) => [p.id, `${p.sei} ${p.mei}`]));
}

export async function GET(request: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!EXPORT_TYPES.includes(type as ExportType)) {
    return NextResponse.json({ error: "不明なエクスポート種別です" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const [{ data: teamId }, { data: role }] = await Promise.all([
    supabase.rpc("current_team_id"),
    supabase.rpc("current_role"),
  ]);
  if (!teamId || role !== "管理者") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const csv = await buildCsv(type as ExportType, supabase, teamId);

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRoleKey) {
    const adminClient = createSupabaseJsClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await recordAuditEvent(adminClient, {
      teamId,
      actorId: user.id,
      action: "data_export",
      targetType: type,
      detail: { type },
    });
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}.csv"`,
    },
  });
}
