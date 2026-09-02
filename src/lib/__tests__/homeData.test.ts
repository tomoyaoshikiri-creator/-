import { describe, expect, it } from "vitest";
import {
  buildDigestItems,
  computeAttendanceActionItems,
  computeTodayBirthdays,
  isWithinDisplayWindow,
  isWithinHoursSinceGameEnd,
  pickUpgradeCandidate,
} from "../homeData";
import type { Attendance, Schedule } from "../database.types";

function schedule(overrides: Partial<Schedule>): Schedule {
  return {
    id: "s1",
    team_id: "t1",
    type: "practice",
    title: "通常練習",
    date: "2026-09-10",
    start_time: null,
    end_time: null,
    place: null,
    toban: null,
    target_grade_min: null,
    game_category: null,
    venue_type: null,
    collect_car_info: false,
    attendance_deadline: null,
    send_attendance_reminders: true,
    fiscal_year_override: null,
    created_by: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

function attendance(overrides: Partial<Attendance>): Attendance {
  return {
    id: "a1",
    schedule_id: "s1",
    user_id: "u1",
    player_id: null,
    status: "出席",
    accompany: null,
    accompany_count: null,
    car: null,
    seats: null,
    setup_available: null,
    setup_count: null,
    note: null,
    updated_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

describe("computeAttendanceActionItems", () => {
  it("紐づく選手のうち未回答のものを拾う(保護者)", () => {
    const items = computeAttendanceActionItems({
      todayStr: "2026-09-05",
      role: "一般",
      userId: "guardian1",
      schedules: [schedule({ id: "s1" })],
      myPlayers: [{ id: "p1", grade: "3", name: "山田太郎" }],
      attendances: [],
    });
    expect(items).toEqual([
      { scheduleId: "s1", scheduleTitle: "通常練習", scheduleDate: "2026-09-10", targetLabel: "山田太郎", kind: "unanswered", overdue: false },
    ]);
  });

  it("紐づく選手が対象学年外なら、代わりに自分の出欠を見る", () => {
    const items = computeAttendanceActionItems({
      todayStr: "2026-09-05",
      role: "一般",
      userId: "guardian1",
      schedules: [schedule({ id: "s1", target_grade_min: "4" })],
      myPlayers: [{ id: "p1", grade: "3", name: "山田太郎" }],
      attendances: [],
    });
    expect(items).toEqual([
      { scheduleId: "s1", scheduleTitle: "通常練習", scheduleDate: "2026-09-10", targetLabel: "自分", kind: "unanswered", overdue: false },
    ]);
  });

  it("指導者は紐づく選手がいても本人の出欠も別途チェックする", () => {
    const items = computeAttendanceActionItems({
      todayStr: "2026-09-05",
      role: "指導者",
      userId: "coach1",
      schedules: [schedule({ id: "s1" })],
      myPlayers: [{ id: "p1", grade: "3", name: "山田太郎" }],
      attendances: [],
    });
    expect(items.map((i) => i.targetLabel).sort()).toEqual(["山田太郎", "本人"]);
  });

  it("期限を過ぎた未回答はoverdue:trueになり先頭に来る", () => {
    const items = computeAttendanceActionItems({
      todayStr: "2026-09-10",
      role: "一般",
      userId: "guardian1",
      schedules: [
        schedule({ id: "s1", date: "2026-09-20", attendance_deadline: null }),
        schedule({ id: "s2", date: "2026-09-15", attendance_deadline: "2026-09-05" }),
      ],
      myPlayers: [],
      attendances: [],
    });
    expect(items[0]).toMatchObject({ scheduleId: "s2", overdue: true });
    expect(items[1]).toMatchObject({ scheduleId: "s1", overdue: false });
  });

  it("出席で車出しが必要な予定なのに未回答ならcarSetup項目になる", () => {
    const items = computeAttendanceActionItems({
      todayStr: "2026-09-05",
      role: "一般",
      userId: "guardian1",
      schedules: [schedule({ id: "s1", type: "game", venue_type: "アウェイ" })],
      myPlayers: [{ id: "p1", grade: "3", name: "山田太郎" }],
      attendances: [attendance({ schedule_id: "s1", player_id: "p1", status: "出席", car: null })],
    });
    expect(items).toEqual([
      { scheduleId: "s1", scheduleTitle: "通常練習", scheduleDate: "2026-09-10", targetLabel: "山田太郎", kind: "carSetup", overdue: false },
    ]);
  });

  it("欠席の場合は車出し未回答でも項目化しない", () => {
    const items = computeAttendanceActionItems({
      todayStr: "2026-09-05",
      role: "一般",
      userId: "guardian1",
      schedules: [schedule({ id: "s1", type: "game", venue_type: "アウェイ" })],
      myPlayers: [{ id: "p1", grade: "3", name: "山田太郎" }],
      attendances: [attendance({ schedule_id: "s1", player_id: "p1", status: "欠席", car: null })],
    });
    expect(items).toEqual([]);
  });

  it("車出し・出欠ともに回答済みなら項目化しない", () => {
    const items = computeAttendanceActionItems({
      todayStr: "2026-09-05",
      role: "一般",
      userId: "guardian1",
      schedules: [schedule({ id: "s1" })],
      myPlayers: [{ id: "p1", grade: "3", name: "山田太郎" }],
      attendances: [attendance({ schedule_id: "s1", player_id: "p1", status: "出席" })],
    });
    expect(items).toEqual([]);
  });
});

describe("buildDigestItems", () => {
  it("未読かつ自分の投稿でないものだけを新しい順に返す", () => {
    const items = buildDigestItems({
      notices: [
        { id: "n1", title: "遠征のお知らせ", created_at: "2026-09-05T10:00:00Z", sender_id: "other" },
        { id: "n2", title: "既読済みのお知らせ", created_at: "2026-09-01T10:00:00Z", sender_id: "other" },
        { id: "n3", title: "自分の投稿", created_at: "2026-09-06T10:00:00Z", sender_id: "me" },
      ],
      dailyReports: [
        {
          id: "r1",
          body: "今日の練習は雨天のため体育館で実施しました",
          created_at: "2026-09-05T12:00:00Z",
          updated_at: "2026-09-05T12:00:00Z",
          author_id: "other",
        },
      ],
      coachNotes: [
        {
          id: "c1",
          body: "コーチ限定メモ",
          created_at: "2026-09-05T13:00:00Z",
          updated_at: "2026-09-05T13:00:00Z",
          author_id: "other",
        },
      ],
      userId: "me",
      noticeSeen: "2026-09-02T00:00:00Z",
      reportSeen: "2026-09-01T00:00:00Z",
      coachNoteSeen: "2026-09-01T00:00:00Z",
      includeCoachNotes: true,
    });
    expect(items.map((i) => i.id)).toEqual(["c1", "r1", "n1"]);
  });

  it("includeCoachNotesがfalseならコーチ日報を含めない", () => {
    const items = buildDigestItems({
      notices: [],
      dailyReports: [],
      coachNotes: [
        {
          id: "c1",
          body: "コーチ限定メモ",
          created_at: "2026-09-05T13:00:00Z",
          updated_at: "2026-09-05T13:00:00Z",
          author_id: "other",
        },
      ],
      userId: "me",
      noticeSeen: "2026-09-01T00:00:00Z",
      reportSeen: "2026-09-01T00:00:00Z",
      coachNoteSeen: "2026-09-01T00:00:00Z",
      includeCoachNotes: false,
    });
    expect(items).toEqual([]);
  });
});

describe("computeTodayBirthdays", () => {
  it("月日が一致する在籍選手だけを返す(年は問わない、年齢は含めない)", () => {
    const result = computeTodayBirthdays(
      [
        { id: "p1", name: "山田太郎", birthday: "2015-09-05" },
        { id: "p2", name: "佐藤花子", birthday: "2010-09-05" },
        { id: "p3", name: "鈴木一郎", birthday: "2015-09-06" },
        { id: "p4", name: "高橋次郎", birthday: null },
      ],
      "2026-09-05",
    );
    expect(result).toEqual([
      { id: "p1", name: "山田太郎" },
      { id: "p2", name: "佐藤花子" },
    ]);
  });
});

describe("isWithinDisplayWindow", () => {
  it("試合日から15日以内ならtrue、超えていればfalse", () => {
    expect(isWithinDisplayWindow("2026-09-01", "2026-09-16", 15)).toBe(true);
    expect(isWithinDisplayWindow("2026-09-01", "2026-09-17", 15)).toBe(false);
  });

  it("未来の日付(まだ先の試合)はfalse", () => {
    expect(isWithinDisplayWindow("2026-09-20", "2026-09-05", 15)).toBe(false);
  });
});

describe("isWithinHoursSinceGameEnd", () => {
  it("end_time設定済みなら、そこから72時間以内かどうかを見る", () => {
    expect(isWithinHoursSinceGameEnd("2026-09-05", "15:00", "2026-09-08T14:00:00", 72)).toBe(true);
    expect(isWithinHoursSinceGameEnd("2026-09-05", "15:00", "2026-09-08T16:00:00", 72)).toBe(false);
  });

  it("end_time未設定なら当日23:59を終了時刻とみなす", () => {
    expect(isWithinHoursSinceGameEnd("2026-09-05", null, "2026-09-06T23:00:00", 72)).toBe(true);
  });
});

describe("pickUpgradeCandidate", () => {
  it("ロールが適格でプランが不足している最も導入しやすい機能を1件だけ返す", () => {
    const candidate = pickUpgradeCandidate("指導者", "お試し");
    expect(candidate).toEqual({ label: "コーチ日報", description: "指導者・管理者だけで共有する日報", requiredPlan: "中間" });
  });

  it("ロール不適格な機能は候補にしない(一般ロールはコーチ日報の対象外)", () => {
    const candidate = pickUpgradeCandidate("一般", "お試し");
    expect(candidate).toBeNull();
  });

  it("すべての機能がプラン内で使える場合はnull", () => {
    expect(pickUpgradeCandidate("管理者", "Max")).toBeNull();
  });
});
