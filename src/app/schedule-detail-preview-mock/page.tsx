"use client";

// ============================================================================
// 検証専用: スケジュール詳細画面(PR #206 / src/app/(app)/schedule/[id]/page.tsx)の
// デザイン刷新を、実データなしでiPhone・iPad miniから確認するためのモック画面。
//
// 位置づけ: このファイルは意図的に`(app)`ルートグループの外(src/app直下)に
// 配置している。`(app)/layout.tsx`はSupabaseセッションを確認し、未ログイン時は
// サーバー側で/loginへリダイレクトする(既存の認証ガード、変更していない)。
// この検証ページはその階層の外にあるため、ログインなしで直接閲覧できる。
//
// Supabaseへの接続・書き込みは一切行わない(createClient等を一切importしていない)。
// 出欠登録・編集・コピー・出欠一覧の各操作はUIの見た目・確認フローのみ再現し、
// 実際の送信・更新・削除・画面遷移は発生しない。
//
// 共通コンポーネントのうちAttendanceEntryForm・AttendanceRosterModal・
// NewScheduleModal・PracticeMenuCardは、内部でuseToast/useSession/Modal(の
// useNavigationGuard)等、(app)配下のProviderに依存しており、このページ単体では
// 動作しない(動作させるにはそれらのProviderが必要になり、このページの
// 「(app)の外に置く」という設計方針と矛盾する)。そのため、これらの見た目を
// 最大限再現した上で、ロジックを持たない簡易版としてこのファイル内に再実装している
// (下部の「実装との差異」節、PR報告にも記載)。
//
// PR #206(src/app/(app)/schedule/[id]/page.tsx)・共通コンポーネント本体は
// 一切変更していない。
// ============================================================================

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cardClass, EmptyState, SectionLabel } from "@/components/ui/Card";
import { Pill, TypeTag } from "@/components/ui/Pill";
import { SegButton, SubmitButton, FieldLabel, inputClass } from "@/components/ui/SegButton";
import { scheduleMeta } from "@/lib/format";
import type { Schedule } from "@/lib/database.types";

type MockRole = "一般" | "管理者";

type AttendanceStatus = "出席" | "欠席" | "遅刻早退" | "見学" | null;

interface MockSubject {
  key: string;
  label: string;
  isSelf: boolean;
  status: AttendanceStatus;
  accompany: "あり" | "なし" | null;
  accompanyCount: string | null;
  car: "可" | "不可" | null;
  seats: string | null;
  note: string | null;
  openByDefault: boolean;
}

interface MockRosterRow {
  key: string;
  name: string;
  status: AttendanceStatus;
  detail: string | null;
}

function makeSchedule(overrides: Partial<Schedule> & Pick<Schedule, "id" | "title">): Schedule {
  return {
    team_id: "mock-team",
    type: "game",
    date: "2026-11-03",
    start_time: "09:00:00",
    end_time: "12:00:00",
    place: "都賀小学校グラウンド",
    toban: "佐藤・鈴木",
    target_grade_min: null,
    game_category: "公式戦",
    venue_type: "アウェイ",
    collect_car_info: false,
    attendance_deadline: null,
    send_attendance_reminders: true,
    fiscal_year_override: null,
    requires_attendance: true,
    is_all_day: false,
    created_by: "mock-admin",
    created_at: "2026-10-20T09:00:00.000Z",
    updated_at: "2026-10-20T09:00:00.000Z",
    ...overrides,
  };
}

const SCHEDULE_NORMAL = makeSchedule({
  id: "mock-schedule-normal",
  title: "稲毛区代表決定戦",
});

const SCHEDULE_LONG = makeSchedule({
  id: "mock-schedule-long",
  title: "第3回千葉県U-12交流大会 予選リーグ 第2試合(雨天時は体育館での練習に変更、詳細は当日連絡)",
});

const SUBJECTS: MockSubject[] = [
  {
    key: "self",
    label: "本人",
    isSelf: true,
    status: "出席",
    accompany: null,
    accompanyCount: null,
    car: "可",
    seats: "2",
    note: null,
    openByDefault: false,
  },
  {
    key: "player-1",
    label: "田中 一郎",
    isSelf: false,
    status: null,
    accompany: null,
    accompanyCount: null,
    car: null,
    seats: null,
    note: null,
    openByDefault: true,
  },
  {
    key: "player-2",
    label: "山本 さくら",
    isSelf: false,
    status: "遅刻早退",
    accompany: "あり",
    accompanyCount: "1",
    car: "不可",
    seats: null,
    note: "15時からの用事のため途中で失礼します",
    openByDefault: false,
  },
];

const ROSTER_ROWS: MockRosterRow[] = [
  { key: "r1", name: "本人", status: "出席", detail: "帯同: なし ・ 車出し: 可(乗車2人)" },
  { key: "r2", name: "田中 一郎", status: null, detail: null },
  { key: "r3", name: "山本 さくら", status: "遅刻早退", detail: "帯同: あり(1名) ・ 車出し: 不可" },
  { key: "r4", name: "鈴木 健太", status: "欠席", detail: null },
  { key: "r5", name: "高橋 みなみ", status: "出席", detail: "帯同: なし ・ 車出し: 可(乗車4人)" },
];

const PROXY_PLAYERS = ["小林 大輔", "渡辺 ゆい"];
const UNLINKED_GUARDIANS = ["中村 保護者A", "加藤 保護者B"];

function statusTone(status: AttendanceStatus): "ok" | "pending" | "absent" | "late" | "watch" {
  if (status === "出席") return "ok";
  if (status === "欠席") return "absent";
  if (status === "遅刻早退") return "late";
  if (status === "見学") return "watch";
  return "pending";
}

function MockHeader({ title }: { title: string }) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-3 text-white"
      style={{ background: "linear-gradient(105deg, #123BDB 0%, #087CF0 40%, #08C6E8 100%)" }}
    >
      <span className="text-lg leading-none">‹</span>
      <div className="font-bold text-[15px] truncate">{title}(モック)</div>
    </div>
  );
}

function ScenarioSwitcher({ role, title }: { role: MockRole; title: "normal" | "long" }) {
  const roleOptions: { key: MockRole; label: string }[] = [
    { key: "一般", label: "一般ロール" },
    { key: "管理者", label: "管理者ロール" },
  ];
  const titleOptions: { key: "normal" | "long"; label: string }[] = [
    { key: "normal", label: "通常タイトル" },
    { key: "long", label: "長いタイトル" },
  ];
  return (
    <div className="mb-3 space-y-1.5">
      <div className="flex gap-1.5 flex-wrap">
        {roleOptions.map((o) => (
          <a
            key={o.key}
            href={`/schedule-detail-preview-mock?role=${o.key === "管理者" ? "kanri" : "ippan"}&title=${title}`}
            className={`min-h-tap flex items-center px-3 py-1.5 rounded-control text-xs font-bold border ${
              o.key === role ? "bg-orange text-white border-orange" : "bg-paper text-ink-soft border-line"
            }`}
          >
            {o.label}
          </a>
        ))}
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {titleOptions.map((o) => (
          <a
            key={o.key}
            href={`/schedule-detail-preview-mock?role=${role === "管理者" ? "kanri" : "ippan"}&title=${o.key}`}
            className={`min-h-tap flex items-center px-3 py-1.5 rounded-control text-xs font-bold border ${
              o.key === title ? "bg-orange text-white border-orange" : "bg-paper text-ink-soft border-line"
            }`}
          >
            {o.label}
          </a>
        ))}
      </div>
    </div>
  );
}

function MockAttendanceEntry({ subject, isGame }: { subject: MockSubject; isGame: boolean }) {
  const [editing, setEditing] = useState(subject.openByDefault);
  const [status, setStatus] = useState<AttendanceStatus>(subject.status);
  const [accompany, setAccompany] = useState(subject.accompany);
  const [car, setCar] = useState(subject.car);
  const [mockMessage, setMockMessage] = useState<string | null>(null);

  function handleMockSubmit() {
    setMockMessage("(モック)実際には登録されません");
    setTimeout(() => setMockMessage(null), 2000);
  }

  return (
    <>
      <SectionLabel>{subject.label}の出欠</SectionLabel>
      <div className={cardClass}>
        {!editing ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <div>{status && <Pill tone={statusTone(status)} size="lg">{status}</Pill>}</div>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex-none min-h-tap flex items-center text-center py-1.5 px-3 rounded-control font-bold text-xs border border-orange text-orange-text bg-orange/8"
              >
                編集する
              </button>
            </div>
            {isGame && !subject.isSelf && subject.accompany && (
              <div className="text-caption text-ink-soft mt-1">
                保護者の帯同: {subject.accompany}
                {subject.accompany === "あり" && `(${subject.accompanyCount}人)`}
              </div>
            )}
            {subject.car && (
              <div className="text-caption text-ink-soft mt-1">
                車出し: {subject.car}
                {subject.car === "可" && `(${subject.seats}人乗車可)`}
              </div>
            )}
            {subject.note && <div className="text-caption text-ink-soft mt-1">備考: {subject.note}</div>}
          </>
        ) : (
          <>
            <div className="flex gap-2 flex-wrap">
              <SegButton variant="small" active={status === "出席"} onClick={() => setStatus("出席")}>
                出席
              </SegButton>
              <SegButton variant="small" active={status === "欠席"} onClick={() => setStatus("欠席")}>
                欠席
              </SegButton>
              {!isGame && (
                <>
                  <SegButton variant="small" active={status === "遅刻早退"} onClick={() => setStatus("遅刻早退")}>
                    遅刻早退
                  </SegButton>
                  <SegButton variant="small" active={status === "見学"} onClick={() => setStatus("見学")}>
                    見学
                  </SegButton>
                </>
              )}
            </div>

            {isGame && !subject.isSelf && (
              <div className="mt-3">
                <FieldLabel>保護者の帯同</FieldLabel>
                <div className="flex gap-2">
                  <SegButton variant="small" active={accompany === "あり"} onClick={() => setAccompany("あり")}>
                    あり
                  </SegButton>
                  <SegButton variant="small" active={accompany === "なし"} onClick={() => setAccompany("なし")}>
                    なし
                  </SegButton>
                </div>
              </div>
            )}

            <div className="mt-3">
              <FieldLabel>車出し</FieldLabel>
              <div className="flex gap-2">
                <SegButton variant="small" active={car === "可"} onClick={() => setCar("可")}>
                  可
                </SegButton>
                <SegButton variant="small" active={car === "不可"} onClick={() => setCar("不可")}>
                  不可
                </SegButton>
              </div>
            </div>

            <div className="mt-3">
              <FieldLabel>備考</FieldLabel>
              <textarea rows={2} className={inputClass()} placeholder="共有事項があれば記入" readOnly />
            </div>

            <SubmitButton onClick={handleMockSubmit}>この内容で登録する</SubmitButton>
            {mockMessage && <div className="text-caption text-ink-soft mt-2 text-center">{mockMessage}</div>}
          </>
        )}
      </div>
    </>
  );
}

function MockRosterPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between mb-2">
        <div className="font-mono text-[10.5px] tracking-widest uppercase text-ink-soft">出欠一覧(モック)</div>
        <button type="button" onClick={onClose} className="text-xs font-bold text-ink-soft min-h-tap px-2">
          閉じる
        </button>
      </div>
      <div className="border border-line rounded-control overflow-hidden">
        {ROSTER_ROWS.map((r) => (
          <div key={r.key} className="border-b border-line last:border-b-0 px-3.5 py-2.5">
            <div className="flex items-center justify-between">
              <div className="font-bold text-sm">{r.name}</div>
              <Pill tone={statusTone(r.status)}>{r.status ?? "未回答"}</Pill>
            </div>
            {r.detail && <div className="text-caption text-ink-soft mt-1">{r.detail}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ScheduleDetailPreviewMockPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh flex items-center justify-center text-sm text-ink-soft">読み込み中…</div>}>
      <ScheduleDetailPreviewMockInner />
    </Suspense>
  );
}

function ScheduleDetailPreviewMockInner() {
  const searchParams = useSearchParams();
  const role: MockRole = searchParams.get("role") === "kanri" ? "管理者" : "一般";
  const titleKey = searchParams.get("title") === "long" ? "long" : "normal";
  const schedule = titleKey === "long" ? SCHEDULE_LONG : SCHEDULE_NORMAL;

  const [rosterOpen, setRosterOpen] = useState(false);
  const [mockMessage, setMockMessage] = useState<string | null>(null);
  const [proxyPlayerId, setProxyPlayerId] = useState("");
  const [unlinkedGuardianId, setUnlinkedGuardianId] = useState("");

  function showMockMessage(text: string) {
    setMockMessage(text);
    setTimeout(() => setMockMessage(null), 2000);
  }

  const isGame = schedule.type === "game";
  const canManage = role === "管理者";

  return (
    <div className="min-h-dvh flex flex-col bg-paper">
      <MockHeader title={schedule.title} />
      <div className="flex-1 overflow-y-auto px-4.5 pt-4 pb-5 relative min-[700px]:px-8 min-[700px]:pt-6">
        <div className="mb-3 rounded-control border border-danger bg-danger/10 px-3 py-2 text-xs font-bold text-danger-text">
          表示専用のダミーデータです。実際の予定データではありません(Supabaseへの読み書きは行われません)。
        </div>

        <ScenarioSwitcher role={role} title={titleKey} />

        {mockMessage && (
          <div className="mb-3 rounded-control border border-line bg-white px-3 py-2 text-xs font-bold text-ink-soft">
            {mockMessage}
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <span className="min-w-tap min-h-tap rounded-control bg-white border border-line flex items-center justify-center text-base text-heading">
            ‹
          </span>
          <span className="min-w-tap min-h-tap rounded-control bg-white border border-line flex items-center justify-center text-base text-heading">
            ›
          </span>
        </div>

        <SectionLabel>予定の内容</SectionLabel>
        <div className={cardClass}>
          <div className="font-bold text-base break-words">
            <TypeTag type={schedule.type} gameCategory={schedule.game_category} />
            {schedule.title}
          </div>
          <div className="text-caption text-ink-soft mt-1.5">{scheduleMeta(schedule)}</div>
          {schedule.toban && <div className="text-caption text-ink-soft mt-1.5">当番:{schedule.toban}</div>}
        </div>

        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setRosterOpen((v) => !v)}
            className="flex-1 min-h-tap flex items-center justify-center px-3 py-1.5 rounded-control border border-orange text-xs font-bold text-orange-text bg-orange/8"
          >
            出欠一覧
          </button>
          <button
            type="button"
            onClick={() => showMockMessage("(モック)編集画面は本モックの対象外です(PR #206は未変更)")}
            className="flex-1 min-h-tap flex items-center justify-center px-3 py-1.5 rounded-control border border-line text-xs font-bold text-ink-soft bg-paper"
          >
            編集
          </button>
          <button
            type="button"
            onClick={() => showMockMessage("(モック)コピー画面は本モックの対象外です(PR #206は未変更)")}
            className="flex-1 min-h-tap flex items-center justify-center px-3 py-1.5 rounded-control border border-line text-xs font-bold text-ink-soft bg-paper"
          >
            コピーして登録
          </button>
        </div>

        {rosterOpen && <MockRosterPanel onClose={() => setRosterOpen(false)} />}

        {SUBJECTS.map((s) => (
          <MockAttendanceEntry key={s.key} subject={s} isGame={isGame} />
        ))}

        {canManage && (
          <>
            <SectionLabel>選手の出欠を代理登録(管理者)</SectionLabel>
            <div className={cardClass}>
              <FieldLabel>選手を選ぶ</FieldLabel>
              <select
                className={inputClass()}
                value={proxyPlayerId}
                onChange={(e) => setProxyPlayerId(e.target.value)}
              >
                <option value="">選手を選択してください</option>
                {PROXY_PLAYERS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <SectionLabel>未紐付けの保護者の出欠を修正・削除(管理者)</SectionLabel>
            <div className={cardClass}>
              <FieldLabel>保護者を選ぶ</FieldLabel>
              <select
                className={inputClass()}
                value={unlinkedGuardianId}
                onChange={(e) => setUnlinkedGuardianId(e.target.value)}
              >
                <option value="">保護者を選択してください</option>
                {UNLINKED_GUARDIANS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {SUBJECTS.length === 0 && <EmptyState>出欠対象者がいません</EmptyState>}
      </div>
    </div>
  );
}
