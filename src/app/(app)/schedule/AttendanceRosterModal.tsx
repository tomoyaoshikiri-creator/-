"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { isTargetEligible, playerFullName, sortPlayers } from "@/lib/format";
import type { Attendance, Role, Schedule, VenueType } from "@/lib/database.types";
import { AttendanceEntryForm } from "./AttendanceEntryForm";

// コーチ陣は管理者を最上段、指導者をその下に表示する。
const STAFF_ROLE_ORDER: Record<string, number> = { 管理者: 0, 指導者: 1 };

interface Row {
  key: string;
  name: string;
  attendance: Attendance | null;
}

// 帯同(保護者が一緒に来るかどうか)は選手に紐づく出欠(保護者→子ども)でのみ収集しており、
// 指導者・未紐付けアカウントの「本人」の出欠では収集していないため表示しない。
function AttendanceGroup({
  title,
  rows,
  showAccompany = true,
  isPlayerGroup = false,
  isEditable,
  expandedKey,
  onToggle,
  scheduleId,
  isGame,
  venueType,
  collectCarInfo,
  editorUserId,
  onChanged,
}: {
  title: string;
  rows: Row[];
  showAccompany?: boolean;
  // 選手に紐づく出欠(player_id)は誰が編集しても「人」ではなく「選手」が識別子なので、
  // 保存時のuser_idには「編集している本人」を渡す(選手一覧タブと同じ挙動)。
  // 本人・未紐付け保護者の出欠(player_id=null)はuser_id自体が識別子なので、rowのkey(=対象者本人)を渡す。
  isPlayerGroup?: boolean;
  isEditable: (key: string) => boolean;
  expandedKey: string | null;
  onToggle: (key: string) => void;
  scheduleId: string;
  isGame: boolean;
  venueType: VenueType | null;
  // 練習・イベントの予定でのみ意味を持つ(試合はvenueTypeで車出しの要否が決まる)。
  collectCarInfo: boolean;
  editorUserId: string;
  onChanged: () => void;
}) {
  const isHome = venueType === "ホーム";
  const showCarSection = isGame ? !isHome : collectCarInfo;
  if (rows.length === 0) return null;
  return (
    <div className="mb-3 last:mb-0">
      <div className="font-mono text-[10.5px] tracking-widest uppercase text-ink-soft mb-1.5">{title}</div>
      <div className="border border-line rounded-2xl overflow-hidden">
        {rows.map((r) => {
          const status = r.attendance?.status ?? null;
          const editable = isEditable(r.key);
          const expanded = expandedKey === r.key;
          return (
            <div key={r.key} className="border-b border-line last:border-b-0">
              <div
                className={`px-3.5 py-2.5 ${editable ? "cursor-pointer" : ""}`}
                onClick={() => editable && onToggle(r.key)}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-[13px]">{r.name}</div>
                  <Pill
                    tone={
                      status === "出席"
                        ? "ok"
                        : status === "欠席"
                          ? "absent"
                          : status === "遅刻早退"
                            ? "late"
                            : status === "見学"
                              ? "watch"
                              : "pending"
                    }
                  >
                    {status ?? "未回答"}
                  </Pill>
                </div>
                {r.attendance &&
                  (() => {
                    const parts: string[] = [];
                    // 帯同・車出し・会場設営は、それぞれ収集対象の予定でのみ表示する
                    // (対象外の予定では常にnullのため、「未回答」を出し続けないようにする)。
                    if (isGame && showAccompany) {
                      parts.push(
                        `帯同: ${
                          r.attendance.accompany === "あり"
                            ? `あり(${r.attendance.accompany_count ?? "-"}名)`
                            : r.attendance.accompany === "なし"
                              ? "なし"
                              : "未回答"
                        }`,
                      );
                    }
                    if (isGame && isHome) {
                      parts.push(
                        `会場設営: ${
                          r.attendance.setup_available === "あり"
                            ? `可能(${r.attendance.setup_count ?? "-"}人)`
                            : r.attendance.setup_available === "なし"
                              ? "不可"
                              : "未回答"
                        }`,
                      );
                    }
                    if (showCarSection) {
                      parts.push(
                        `車出し: ${
                          r.attendance.car === "可"
                            ? `可(乗車${r.attendance.seats ?? "-"}人)`
                            : r.attendance.car === "不可"
                              ? "不可"
                              : "未回答"
                        }`,
                      );
                    }
                    if (r.attendance.note) parts.push(`備考:${r.attendance.note}`);
                    if (parts.length === 0) return null;
                    return <div className="text-[11px] text-ink-soft mt-1">{parts.join(" ・ ")}</div>;
                  })()}
              </div>
              {expanded && (
                <div className="px-3.5 pb-3.5" onClick={(e) => e.stopPropagation()}>
                  <AttendanceEntryForm
                    scheduleId={scheduleId}
                    userId={isPlayerGroup ? editorUserId : r.key}
                    playerId={isPlayerGroup ? r.key : null}
                    label={r.name}
                    isGame={isGame}
                    venueType={venueType}
                    collectCarInfo={collectCarInfo}
                    allowDelete
                    onChanged={onChanged}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AttendanceRosterModal({
  schedule,
  open,
  onClose,
  userId,
  role,
}: {
  schedule: Schedule;
  open: boolean;
  onClose: () => void;
  userId: string;
  role: Role;
}) {
  const [playerRows, setPlayerRows] = useState<Row[]>([]);
  const [staffRows, setStaffRows] = useState<Row[]>([]);
  const [otherRows, setOtherRows] = useState<Row[]>([]);
  const [linkedPlayerIds, setLinkedPlayerIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: players }, { data: profiles }, { data: attendances }, { data: links }] = await Promise.all([
      supabase.rpc("list_roster_players"),
      supabase.from("profiles").select("id, name, role").order("name"),
      supabase.from("attendances").select("*").eq("schedule_id", schedule.id),
      supabase.from("player_guardians").select("player_id").eq("profile_id", userId),
    ]);

    const attByPlayer = new Map(
      (attendances ?? []).filter((a) => a.player_id).map((a) => [a.player_id as string, a]),
    );
    const attByUser = new Map((attendances ?? []).filter((a) => !a.player_id).map((a) => [a.user_id, a]));

    setPlayerRows(
      sortPlayers((players ?? []).filter((p) => isTargetEligible(p.grade, schedule.target_grade_min))).map((p) => ({
        key: p.id,
        name: playerFullName(p),
        attendance: attByPlayer.get(p.id) ?? null,
      })),
    );

    const staff = (profiles ?? [])
      .filter((p) => p.role === "指導者" || p.role === "管理者")
      .sort((a, b) => STAFF_ROLE_ORDER[a.role] - STAFF_ROLE_ORDER[b.role] || a.name.localeCompare(b.name));
    setStaffRows(staff.map((p) => ({ key: p.id, name: p.name, attendance: attByUser.get(p.id) ?? null })));

    const staffIds = new Set(staff.map((p) => p.id));
    setOtherRows(
      (profiles ?? [])
        .filter((p) => !staffIds.has(p.id) && attByUser.has(p.id))
        .map((p) => ({ key: p.id, name: p.name, attendance: attByUser.get(p.id) ?? null })),
    );

    setLinkedPlayerIds(new Set((links ?? []).map((l) => l.player_id)));
    setLoading(false);
  }, [schedule.id, schedule.target_grade_min, userId]);

  useEffect(() => {
    if (!open) return;
    setExpandedKey(null);
    load();
  }, [open, load]);

  function handleChanged() {
    setExpandedKey(null);
    load();
  }

  const isAdmin = role === "管理者";
  const isGame = schedule.type === "game";
  const isHome = schedule.venue_type === "ホーム";
  const showCarSection = isGame ? !isHome : schedule.collect_car_info;
  const allRows = [...playerRows, ...staffRows, ...otherRows];
  const attendingCount = allRows.filter((r) => r.attendance?.status === "出席").length;
  const absentCount = allRows.filter((r) => r.attendance?.status === "欠席").length;
  const lateCount = allRows.filter((r) => r.attendance?.status === "遅刻早退").length;
  const watchCount = allRows.filter((r) => r.attendance?.status === "見学").length;
  const noResponseCount = allRows.length - attendingCount - absentCount - lateCount - watchCount;
  const totalAccompany = allRows.reduce(
    (sum, r) => sum + (r.attendance?.accompany === "あり" ? (r.attendance.accompany_count ?? 0) : 0),
    0,
  );
  const carAvailableCount = allRows.filter((r) => r.attendance?.car === "可").length;
  const totalSeats = allRows.reduce(
    (sum, r) => sum + (r.attendance?.car === "可" ? (r.attendance.seats ?? 0) : 0),
    0,
  );
  const setupAvailableCount = allRows.filter((r) => r.attendance?.setup_available === "あり").length;
  const totalSetupCount = allRows.reduce(
    (sum, r) => sum + (r.attendance?.setup_available === "あり" ? (r.attendance.setup_count ?? 0) : 0),
    0,
  );

  return (
    <Modal open={open} onClose={onClose} title={`出欠一覧:${schedule.title}`}>
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg bg-green/10 text-green">
              出席 {attendingCount}
            </span>
            <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg bg-danger/10 text-danger">
              欠席 {absentCount}
            </span>
            {lateCount > 0 && (
              <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg bg-sky/10 text-sky">
                遅刻早退 {lateCount}
              </span>
            )}
            {watchCount > 0 && (
              <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg bg-ink-soft/10 text-ink-soft">
                見学 {watchCount}
              </span>
            )}
            <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg bg-orange/10 text-orange">
              未回答 {noResponseCount}
            </span>
          </div>

          {(isGame || showCarSection) && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {isGame && (
                <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg bg-navy/8 text-navy">
                  帯同合計 {totalAccompany}名
                </span>
              )}
              {isGame && isHome && (
                <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg bg-navy/8 text-navy">
                  会場設営可 {setupAvailableCount}名(合計{totalSetupCount}人)
                </span>
              )}
              {showCarSection && (
                <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg bg-navy/8 text-navy">
                  車出し可 {carAvailableCount}名(乗車可能 合計{totalSeats}人)
                </span>
              )}
            </div>
          )}

          {allRows.length === 0 ? (
            <EmptyState>メンバーがいません</EmptyState>
          ) : (
            <>
              <AttendanceGroup
                title="選手"
                rows={playerRows}
                isPlayerGroup
                isEditable={(key) => isAdmin || linkedPlayerIds.has(key)}
                expandedKey={expandedKey}
                onToggle={(key) => setExpandedKey((cur) => (cur === key ? null : key))}
                scheduleId={schedule.id}
                isGame={isGame}
                venueType={schedule.venue_type}
                collectCarInfo={schedule.collect_car_info}
                editorUserId={userId}
                onChanged={handleChanged}
              />
              <AttendanceGroup
                title="指導者"
                rows={staffRows}
                showAccompany={false}
                isEditable={(key) => isAdmin || key === userId}
                expandedKey={expandedKey}
                onToggle={(key) => setExpandedKey((cur) => (cur === key ? null : key))}
                scheduleId={schedule.id}
                isGame={isGame}
                venueType={schedule.venue_type}
                collectCarInfo={schedule.collect_car_info}
                editorUserId={userId}
                onChanged={handleChanged}
              />
              <AttendanceGroup
                title="未紐付けの保護者"
                rows={otherRows}
                showAccompany={false}
                isEditable={(key) => isAdmin || key === userId}
                expandedKey={expandedKey}
                onToggle={(key) => setExpandedKey((cur) => (cur === key ? null : key))}
                scheduleId={schedule.id}
                isGame={isGame}
                venueType={schedule.venue_type}
                collectCarInfo={schedule.collect_car_info}
                editorUserId={userId}
                onChanged={handleChanged}
              />
            </>
          )}
        </>
      )}
    </Modal>
  );
}
