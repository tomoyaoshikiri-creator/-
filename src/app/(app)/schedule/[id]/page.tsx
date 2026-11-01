"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { cardClass, EmptyState, SectionLabel } from "@/components/ui/Card";
import { TypeTag } from "@/components/ui/Pill";
import { FieldLabel, inputClass } from "@/components/ui/SegButton";
import { ChevronRightIcon } from "@/components/icons";
import { formatDateLabel, isTargetEligible, playerFullName, sortPlayers } from "@/lib/format";
import { canWriteSchedule } from "@/lib/permissions";
import type { Player, Schedule } from "@/lib/database.types";
import { AttendanceEntryForm } from "../AttendanceEntryForm";
import { AttendanceRosterModal } from "../AttendanceRosterModal";
import { NewScheduleModal } from "../NewScheduleModal";
import { PracticeMenuCard } from "../PracticeMenuCard";

interface AttendanceSubject {
  key: string;
  playerId: string | null;
  label: string;
}

interface AttendanceSummary {
  attending: number;
  absent: number;
  late: number;
  watch: number;
  noResponse: number;
}

// scheduleMeta()(@/lib/format、一覧画面等で共通利用)と同じ時刻表示ロジックだが、
// 詳細画面では場所・当番を別行に分けて表示するため、場所を含まない日時部分だけを
// ここで組み立てる(共通関数自体は変更しない)。
function scheduleDateTimeLabel(s: Schedule): string {
  const date = formatDateLabel(s.date);
  if (s.is_all_day) return `${date} 終日`;
  if (s.start_time && s.end_time) return `${date} ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`;
  if (s.start_time) return `${date} ${s.start_time.slice(0, 5)}〜`;
  return date;
}

export default function ScheduleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { userId, role, requireUnlinkedGuardianAttendance } = useSession();
  const toast = useToast();

  // 以前はuseFocusMode(true)で通常の下部5タブを非表示にしていたが、実機フィードバックに
  // より通常5タブを常時表示する方針に変更した(閲覧時・実施メニュー編集中とも同じ)。
  // PageShellはfocusMode=false相当のpb-28(下部ピルの裏にコンテンツが隠れないための
  // 余白)を使うため、保存・キャンセル等の操作ボタンも通常5タブと重ならない。
  // ヘッダーの戻る(backHref)・ハンバーガーは元々focusModeと独立しているため無変更。

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [subjects, setSubjects] = useState<AttendanceSubject[]>([]);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [excludedLinkedCount, setExcludedLinkedCount] = useState(0);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [proxyPlayers, setProxyPlayers] = useState<Player[]>([]);
  const [proxyPlayerId, setProxyPlayerId] = useState("");
  const [unlinkedGuardians, setUnlinkedGuardians] = useState<{ id: string; name: string }[]>([]);
  const [unlinkedGuardianId, setUnlinkedGuardianId] = useState("");
  const [prevId, setPrevId] = useState<string | null>(null);
  const [nextId, setNextId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    const [{ data: s }, { data: links }] = await Promise.all([
      supabase.from("schedules").select("*").eq("id", params.id).single(),
      supabase.from("player_guardians").select("player_id").eq("profile_id", userId),
    ]);
    setSchedule(s ?? null);

    if (s) {
      const [{ data: prevRows }, { data: nextRows }] = await Promise.all([
        supabase
          .from("schedules")
          .select("id")
          .or(`date.lt.${s.date},and(date.eq.${s.date},created_at.lt.${s.created_at})`)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("schedules")
          .select("id")
          .or(`date.gt.${s.date},and(date.eq.${s.date},created_at.gt.${s.created_at})`)
          .order("date", { ascending: true })
          .order("created_at", { ascending: true })
          .limit(1),
      ]);
      setPrevId(prevRows?.[0]?.id ?? null);
      setNextId(nextRows?.[0]?.id ?? null);
    } else {
      setPrevId(null);
      setNextId(null);
    }

    const playerIds = (links ?? []).map((l) => l.player_id);
    let linkedPlayers: Player[] = [];
    if (playerIds.length > 0) {
      const { data: p } = await supabase.from("players").select("*").in("id", playerIds);
      linkedPlayers = p ?? [];
    }

    const targetGradeMin = s?.target_grade_min ?? null;
    const eligibleLinked = linkedPlayers.filter((p) => isTargetEligible(p.grade, targetGradeMin));

    const list: AttendanceSubject[] = [];
    if (role === "指導者" || role === "管理者") {
      list.push({ key: "self", playerId: null, label: "本人" });
    }
    for (const p of eligibleLinked) {
      list.push({ key: p.id, playerId: p.id, label: playerFullName(p) });
    }
    if (list.length === 0 && requireUnlinkedGuardianAttendance) {
      list.push({ key: "self", playerId: null, label: "自分" });
    }
    setSubjects(list);
    setExcludedLinkedCount(linkedPlayers.length - eligibleLinked.length);

    // 回答進捗サマリー(対象者2名以上の場合のみ画面側で表示)用に、対象者ごとの
    // 出欠登録済み件数のみを読み取り専用で確認する。AttendanceEntryForm自体の
    // 読み込み・登録・更新・削除ロジックには一切影響しない、新規の参照のみ。
    if (s && list.length > 1) {
      const { data: attendanceRows } = await supabase
        .from("attendances")
        .select("user_id, player_id")
        .eq("schedule_id", s.id);
      const registeredPlayerIds = new Set((attendanceRows ?? []).filter((a) => a.player_id).map((a) => a.player_id));
      const selfRegistered = (attendanceRows ?? []).some((a) => !a.player_id && a.user_id === userId);
      setAnsweredCount(
        list.filter((subj) => (subj.playerId ? registeredPlayerIds.has(subj.playerId) : selfRegistered)).length,
      );
    } else {
      setAnsweredCount(0);
    }

    // 出欠状況カードの「出席・欠席・未回答」集計。チーム全体(選手・指導者・管理者・出欠済みの
    // 未紐付け保護者)が対象で、AttendanceRosterModal(出欠一覧)の既存の集計仕様(対象者の
    // 組み立て方・ステータス区分)と同じ考え方で読み取り専用に再計算する。モーダル自体の
    // ロジック・表示は変更していない。
    if (s && s.requires_attendance) {
      const [{ data: rosterPlayers }, { data: members }, { data: summaryAttendanceRows }] = await Promise.all([
        supabase.rpc("list_roster_players"),
        supabase.rpc("list_team_members"),
        supabase.from("attendances").select("status, player_id, user_id").eq("schedule_id", s.id),
      ]);
      const eligiblePlayerIds = (rosterPlayers ?? [])
        .filter((p) => isTargetEligible(p.grade, s.target_grade_min))
        .map((p) => p.id);
      const staffIds = new Set(
        (members ?? []).filter((m) => m.role === "指導者" || m.role === "管理者").map((m) => m.id),
      );
      const attByPlayer = new Map(
        (summaryAttendanceRows ?? []).filter((a) => a.player_id).map((a) => [a.player_id as string, a]),
      );
      const attByUser = new Map((summaryAttendanceRows ?? []).filter((a) => !a.player_id).map((a) => [a.user_id, a]));
      const otherIds = (members ?? []).filter((m) => !staffIds.has(m.id) && attByUser.has(m.id)).map((m) => m.id);
      const statuses = [
        ...eligiblePlayerIds.map((id) => attByPlayer.get(id)?.status ?? null),
        ...[...staffIds].map((id) => attByUser.get(id)?.status ?? null),
        ...otherIds.map((id) => attByUser.get(id)?.status ?? null),
      ];
      const attending = statuses.filter((st) => st === "出席").length;
      const absent = statuses.filter((st) => st === "欠席").length;
      const late = statuses.filter((st) => st === "遅刻早退").length;
      const watch = statuses.filter((st) => st === "見学").length;
      const noResponse = statuses.length - attending - absent - late - watch;
      setAttendanceSummary({ attending, absent, late, watch, noResponse });
    } else {
      setAttendanceSummary(null);
    }

    if (role === "管理者") {
      const { data: allPlayers } = await supabase.from("players").select("*").eq("status", "在籍");
      const coveredIds = new Set(eligibleLinked.map((p) => p.id));
      setProxyPlayers(
        sortPlayers(
          (allPlayers ?? [])
            .filter((p) => isTargetEligible(p.grade, targetGradeMin))
            .filter((p) => !coveredIds.has(p.id)),
        ),
      );

      // roleは現在チームのteam_membershipsを正本とするlist_team_members()から取得する
      // (profiles.roleはlegacy情報のため使用しない)。
      const [{ data: members }, { data: allLinks }] = await Promise.all([
        supabase.rpc("list_team_members"),
        supabase.from("player_guardians").select("profile_id"),
      ]);
      const guardianProfiles = (members ?? [])
        .filter((m) => m.role === "一般" || m.role === "運営")
        .sort((a, b) => a.name.localeCompare(b.name));
      const linkedIds = new Set((allLinks ?? []).map((l) => l.profile_id));
      setUnlinkedGuardians((guardianProfiles ?? []).filter((p) => !linkedIds.has(p.id)));
    } else {
      setProxyPlayers([]);
      setUnlinkedGuardians([]);
    }
    setProxyPlayerId("");
    setUnlinkedGuardianId("");
    setLoading(false);
  }, [params.id, userId, role, requireUnlinkedGuardianAttendance]);

  useEffect(() => {
    load();
  }, [load]);

  const isGame = schedule?.type === "game";

  return (
    <PageShell header={<AppHeader title="スケジュール詳細" variant="detail" backHref="/schedule" />}>
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : !schedule ? (
        <EmptyState>予定が見つかりません</EmptyState>
      ) : (
        <>
          {/* 1. 予定情報カード: 種別・タイトル・日時・場所・当番と、予定の編集・コピーを
              カード内に横並びで配置する(以前のように折りたたみ内に隠さない)。 */}
          <SectionLabel>予定の内容</SectionLabel>
          <div className={cardClass}>
            <div className="font-bold text-base break-words">
              <TypeTag type={schedule.type} gameCategory={schedule.game_category} />
              {schedule.title}
            </div>
            <div className="text-caption text-ink-soft mt-1.5">
              <span className="font-bold text-ink">日時:</span> {scheduleDateTimeLabel(schedule)}
            </div>
            {schedule.place && (
              <div className="text-caption text-ink-soft mt-1">
                <span className="font-bold text-ink">場所:</span> {schedule.place}
              </div>
            )}
            {schedule.toban && (
              <div className="text-caption text-ink-soft mt-1">
                <span className="font-bold text-ink">当番:</span> {schedule.toban}
              </div>
            )}
            {canWriteSchedule(role) && (
              <div className="flex gap-2 mt-3 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="flex-1 min-h-tap flex items-center justify-center px-3 py-1.5 rounded-control border border-line text-xs font-bold text-ink-soft bg-paper"
                >
                  予定を編集
                </button>
                <button
                  type="button"
                  onClick={() => setCopyOpen(true)}
                  className="flex-1 min-h-tap flex items-center justify-center px-3 py-1.5 rounded-control border border-line text-xs font-bold text-ink-soft bg-paper"
                >
                  コピーして登録
                </button>
              </div>
            )}
          </div>
          {canWriteSchedule(role) && (
            <>
              <NewScheduleModal
                open={editOpen}
                onClose={() => setEditOpen(false)}
                editSchedule={schedule}
                onCreated={() => {
                  setEditOpen(false);
                  load();
                }}
                onDeleted={() => {
                  setEditOpen(false);
                  toast.success("予定を削除しました");
                  router.push("/schedule");
                }}
              />
              <NewScheduleModal
                open={copyOpen}
                onClose={() => setCopyOpen(false)}
                copySource={schedule}
                onCreated={() => {
                  setCopyOpen(false);
                  toast.success("予定をコピーして登録しました");
                  router.push("/schedule");
                }}
              />
            </>
          )}

          {/* 2. 実施メニューカード: 練習予定の場合のみ(PracticeMenuCard内部の表示/編集モードは
              自己完結。呼び出し方自体は無変更)。 */}
          {schedule.type === "practice" && <PracticeMenuCard scheduleId={schedule.id} scheduleDate={schedule.date} />}

          {/* 3. 出欠状況カード: 集計(出席/欠席/未回答)・出欠一覧への導線・進捗サマリーを
              1枚のカードにまとめる。本人・家族ごとのAttendanceEntryForm(既存の自動展開等)は
              このカードの下に、これまでと同じ形で個別に並べる(無変更)。 */}
          {schedule.requires_attendance && (
            <>
              <SectionLabel
                action={
                  <button
                    type="button"
                    onClick={() => setRosterOpen(true)}
                    className="flex-shrink-0 whitespace-nowrap min-h-tap flex items-center text-caption font-bold text-orange-text"
                  >
                    出欠一覧を見る
                  </button>
                }
              >
                出欠
              </SectionLabel>

              <div className={cardClass}>
                {excludedLinkedCount > 0 && (
                  <div className="text-xs text-ink-soft text-center mb-2.5">
                    ※この予定の対象学年外のため、出欠登録の対象外のお子さまがいます
                  </div>
                )}

                {attendanceSummary && (
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg bg-green/10 text-green-text">
                      出席 {attendanceSummary.attending}
                    </span>
                    <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg bg-danger/10 text-danger-text">
                      欠席 {attendanceSummary.absent}
                    </span>
                    {attendanceSummary.late > 0 && (
                      <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg bg-sky/10 text-sky">
                        遅刻早退 {attendanceSummary.late}
                      </span>
                    )}
                    {attendanceSummary.watch > 0 && (
                      <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg bg-ink-soft/10 text-ink-soft">
                        見学 {attendanceSummary.watch}
                      </span>
                    )}
                    <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg bg-orange/10 text-orange-text">
                      未回答 {attendanceSummary.noResponse}
                    </span>
                  </div>
                )}

                {subjects.length > 1 && (
                  <div className="text-sm font-bold text-center">
                    {subjects.length}名中{answeredCount}名回答済み
                  </div>
                )}
              </div>

              {subjects.map((subject) => (
                <AttendanceEntryForm
                  key={subject.key}
                  scheduleId={schedule.id}
                  userId={userId}
                  playerId={subject.playerId}
                  label={subject.label}
                  isGame={isGame}
                  venueType={schedule.venue_type}
                  collectCarInfo={schedule.collect_car_info}
                />
              ))}

              <AttendanceRosterModal
                schedule={schedule}
                open={rosterOpen}
                onClose={() => setRosterOpen(false)}
                userId={userId}
                role={role}
              />
            </>
          )}

          {/* 4. 管理者専用操作: 代理登録・未紐付け保護者の修正を集約した折りたたみセクション
              (既定で閉じる、管理者のみ)。表示条件(role==="管理者"/schedule.requires_attendance)は
              無変更。予定の編集・コピーはこの中に戻さない。 */}
          {role === "管理者" &&
            schedule.requires_attendance &&
            (proxyPlayers.length > 0 || unlinkedGuardians.length > 0) && (
              <>
                <button
                  type="button"
                  onClick={() => setManageOpen((v) => !v)}
                  className="w-full min-h-tap flex items-center justify-between gap-2 mb-2"
                >
                  <span className="font-mono text-[10.5px] font-bold tracking-widest uppercase text-ink-soft">
                    管理者専用操作
                  </span>
                  <ChevronRightIcon
                    className={`w-3.5 h-3.5 text-ink-soft flex-shrink-0 transition-transform ${
                      manageOpen ? "rotate-90" : ""
                    }`}
                  />
                </button>

                {manageOpen && (
                  <>
                    {proxyPlayers.length > 0 && (
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
                            {proxyPlayers.map((p) => (
                              <option key={p.id} value={p.id}>
                                {playerFullName(p)}
                              </option>
                            ))}
                          </select>
                        </div>
                        {proxyPlayerId && (
                          <AttendanceEntryForm
                            key={proxyPlayerId}
                            scheduleId={schedule.id}
                            userId={userId}
                            playerId={proxyPlayerId}
                            label={playerFullName(proxyPlayers.find((p) => p.id === proxyPlayerId)!)}
                            isGame={isGame}
                            venueType={schedule.venue_type}
                            collectCarInfo={schedule.collect_car_info}
                          />
                        )}
                      </>
                    )}

                    {unlinkedGuardians.length > 0 && (
                      <>
                        <SectionLabel>未紐付けの保護者の出欠を修正・削除(管理者)</SectionLabel>
                        <div className={cardClass}>
                          <FieldLabel>保護者を選ぶ</FieldLabel>
                          <select
                            className={inputClass()}
                            value={unlinkedGuardianId}
                            onChange={(e) => setUnlinkedGuardianId(e.target.value)}
                          >
                            <option value="">保護者を選択してください</option>
                            {unlinkedGuardians.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        {unlinkedGuardianId && (
                          <AttendanceEntryForm
                            key={unlinkedGuardianId}
                            scheduleId={schedule.id}
                            userId={unlinkedGuardianId}
                            playerId={null}
                            label={unlinkedGuardians.find((p) => p.id === unlinkedGuardianId)!.name}
                            isGame={isGame}
                            venueType={schedule.venue_type}
                            collectCarInfo={schedule.collect_car_info}
                            allowDelete
                          />
                        )}
                      </>
                    )}
                  </>
                )}
              </>
            )}

          {/* 5. 前後の予定: 画面下部への固定表示はせず、通常のコンテンツ最下部に横並びで配置する
              (遷移対象の判定・prevId/nextIdの取得ロジックは無変更)。 */}
          <div className="flex gap-2 mt-5">
            {prevId ? (
              <Link
                href={`/schedule/${prevId}`}
                className="flex-1 min-h-tap flex items-center justify-center gap-1 rounded-control border border-line bg-white text-xs font-bold text-heading"
              >
                <span aria-hidden>‹</span>
                <span>前の予定</span>
              </Link>
            ) : (
              <span className="flex-1 min-h-tap flex items-center justify-center gap-1 rounded-control border border-line bg-white text-xs font-bold text-line">
                <span aria-hidden>‹</span>
                <span>前の予定</span>
              </span>
            )}
            {nextId ? (
              <Link
                href={`/schedule/${nextId}`}
                className="flex-1 min-h-tap flex items-center justify-center gap-1 rounded-control border border-line bg-white text-xs font-bold text-heading"
              >
                <span>次の予定</span>
                <span aria-hidden>›</span>
              </Link>
            ) : (
              <span className="flex-1 min-h-tap flex items-center justify-center gap-1 rounded-control border border-line bg-white text-xs font-bold text-line">
                <span>次の予定</span>
                <span aria-hidden>›</span>
              </span>
            )}
          </div>
        </>
      )}
    </PageShell>
  );
}
