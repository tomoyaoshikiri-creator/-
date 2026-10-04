"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState } from "@/components/ui/Card";
import { SegButton, FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { canRecordShootingDrill } from "@/lib/permissions";
import { hasShootingDrillAccess } from "@/lib/plan";
import { useUnsavedChangesGuard } from "@/lib/navigationGuard";
import {
  SHOOTING_DRILL_TARGET_OPTIONS,
  isDrillComplete,
  nextShotCategory,
  summarizeShots,
  totalPointsFromCounts,
  type ShotCategory,
  type ShootingDrillTarget,
} from "@/lib/shootingDrill";
import { playerFullName, sortPlayers, todayDateStr } from "@/lib/format";
import type { Player } from "@/lib/database.types";

const CATEGORY_LABEL: Record<ShotCategory, string> = { three: "3P", mid: "ミドル", layup: "ゴール下" };

function formatElapsed(ms: number): string {
  const totalTenths = Math.floor(ms / 100);
  const sec = Math.floor(totalTenths / 10);
  const tenths = totalTenths % 10;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}.${tenths}`;
}

export default function ShootingDrillNewPage() {
  const router = useRouter();
  const { teamId, role, plan, userId } = useSession();
  const toast = useToast();
  const canRecord = canRecordShootingDrill(role);

  useEffect(() => {
    if (!hasShootingDrillAccess(plan)) router.replace("/team");
    else if (!canRecord) router.replace("/karte/team/shooting");
  }, [plan, canRecord, router]);

  const [players, setPlayers] = useState<Player[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);

  useEffect(() => {
    if (!hasShootingDrillAccess(plan) || !canRecord) return;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("players").select("*").eq("status", "在籍");
      setPlayers(sortPlayers(data ?? []));
      setLoadingPlayers(false);
    })();
  }, [plan, canRecord]);

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [targetPoints, setTargetPoints] = useState<ShootingDrillTarget>(21);
  const [phase, setPhase] = useState<"setup" | "running" | "done">("setup");
  const [shots, setShots] = useState<boolean[]>([]);
  const [accumulatedMs, setAccumulatedMs] = useState(0);
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [saving, setSaving] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useUnsavedChangesGuard(phase === "running" || phase === "done");

  // 0.1秒単位の表示更新。Date.now()はレンダー中に直接呼ばず、effect(レンダー外)の中で
  // 経過時間を算出してstateへ反映する。
  useEffect(() => {
    if (phase !== "running" || runStartedAt === null) return;
    const update = () => setElapsedMs(accumulatedMs + (Date.now() - runStartedAt));
    update();
    const id = setInterval(update, 100);
    return () => clearInterval(id);
  }, [phase, runStartedAt, accumulatedMs]);

  useEffect(() => {
    async function requestWakeLock() {
      if (!("wakeLock" in navigator)) return;
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      } catch {
        // 取得できない端末・状況では何もしない。
      }
    }
    function releaseWakeLock() {
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    }
    if (phase === "running") {
      requestWakeLock();
      const onVisible = () => {
        if (document.visibilityState === "visible" && phase === "running") requestWakeLock();
      };
      document.addEventListener("visibilitychange", onVisible);
      return () => {
        document.removeEventListener("visibilitychange", onVisible);
        releaseWakeLock();
      };
    }
    releaseWakeLock();
  }, [phase]);

  function handleStart() {
    if (!selectedPlayerId) {
      toast("選手を選んでください");
      return;
    }
    setShots([]);
    setAccumulatedMs(0);
    setElapsedMs(0);
    setRunStartedAt(Date.now());
    setPhase("running");
  }

  function handleShot(made: boolean) {
    const next = [...shots, made];
    setShots(next);
    if (isDrillComplete(next, targetPoints)) {
      const finalMs = accumulatedMs + (runStartedAt !== null ? Date.now() - runStartedAt : 0);
      setAccumulatedMs(finalMs);
      setElapsedMs(finalMs);
      setRunStartedAt(null);
      setPhase("done");
    }
  }

  function handleUndo() {
    if (shots.length === 0) return;
    setShots((prev) => prev.slice(0, -1));
    if (phase === "done") {
      // 終了後に押した場合は計測を再開する。
      setRunStartedAt(Date.now());
      setPhase("running");
    }
  }

  function handleReset() {
    setShots([]);
    setAccumulatedMs(0);
    setElapsedMs(0);
    setRunStartedAt(null);
    setPhase("setup");
  }

  async function handleSave() {
    if (!selectedPlayerId) return;
    const summary = summarizeShots(shots);
    const time_sec = Math.round((elapsedMs / 1000) * 10) / 10;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("shooting_drill_records").insert({
      team_id: teamId,
      player_id: selectedPlayerId,
      recorded_on: todayDateStr(),
      target_points: targetPoints,
      time_sec,
      three_made: summary.three_made,
      three_att: summary.three_att,
      mid_made: summary.mid_made,
      mid_att: summary.mid_att,
      layup_made: summary.layup_made,
      layup_att: summary.layup_att,
      shots,
      input_method: "timer",
      recorded_by: userId,
    });
    setSaving(false);
    if (error) {
      toast(`保存に失敗しました: ${error.message}`);
      return;
    }
    toast("記録を保存しました");
    router.push("/karte/team/shooting");
  }

  // 手入力フォーム(紙の記録の取り込み)。目標点は21点固定。
  const [manualOpen, setManualOpen] = useState(false);
  const [manualPlayerId, setManualPlayerId] = useState<string | null>(null);
  const [manualDate, setManualDate] = useState(todayDateStr());
  const [manualMin, setManualMin] = useState("");
  const [manualSec, setManualSec] = useState("");
  const [manualThreeMade, setManualThreeMade] = useState("");
  const [manualThreeAtt, setManualThreeAtt] = useState("");
  const [manualMidMade, setManualMidMade] = useState("");
  const [manualMidAtt, setManualMidAtt] = useState("");
  const [manualLayupMade, setManualLayupMade] = useState("");
  const [manualLayupAtt, setManualLayupAtt] = useState("");
  const [manualSaving, setManualSaving] = useState(false);

  const manualTotal = totalPointsFromCounts({
    three_made: Number(manualThreeMade) || 0,
    mid_made: Number(manualMidMade) || 0,
    layup_made: Number(manualLayupMade) || 0,
  });

  function resetManualForm() {
    setManualPlayerId(null);
    setManualDate(todayDateStr());
    setManualMin("");
    setManualSec("");
    setManualThreeMade("");
    setManualThreeAtt("");
    setManualMidMade("");
    setManualMidAtt("");
    setManualLayupMade("");
    setManualLayupAtt("");
  }

  async function handleManualSave() {
    const three_made = Number(manualThreeMade);
    const three_att = Number(manualThreeAtt);
    const mid_made = Number(manualMidMade);
    const mid_att = Number(manualMidAtt);
    const layup_made = Number(manualLayupMade);
    const layup_att = Number(manualLayupAtt);
    const min = Number(manualMin) || 0;
    const sec = Number(manualSec) || 0;
    const time_sec = Math.round((min * 60 + sec) * 10) / 10;
    if (!manualPlayerId) {
      toast("選手を選んでください");
      return;
    }
    if (
      [three_made, three_att, mid_made, mid_att, layup_made, layup_att].some((n) => Number.isNaN(n) || n < 0) ||
      three_made > three_att ||
      mid_made > mid_att ||
      layup_made > layup_att ||
      time_sec <= 0
    ) {
      toast("入力内容を確認してください");
      return;
    }
    setManualSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("shooting_drill_records").insert({
      team_id: teamId,
      player_id: manualPlayerId,
      recorded_on: manualDate,
      target_points: 21,
      time_sec,
      three_made,
      three_att,
      mid_made,
      mid_att,
      layup_made,
      layup_att,
      shots: null,
      input_method: "manual",
      recorded_by: userId,
    });
    setManualSaving(false);
    if (error) {
      toast(`保存に失敗しました: ${error.message}`);
      return;
    }
    resetManualForm();
    toast("記録を保存しました");
    router.push("/karte/team/shooting");
  }

  if (!hasShootingDrillAccess(plan) || !canRecord) return null;

  const selectedPlayer = players.find((p) => p.id === selectedPlayerId);
  const summary = summarizeShots(shots);
  const upcoming = phase === "running" ? nextShotCategory(shots) : null;

  return (
    <PageShell header={<AppHeader title="シュート練習記録の計測" variant="detail" backHref="/karte/team/shooting" accessBadge="coach" />}>
      {loadingPlayers ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : phase === "setup" ? (
        <>
          <Card>
            <FieldLabel>選手</FieldLabel>
            {players.length === 0 ? (
              <EmptyState>在籍中の選手がいません</EmptyState>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-[40vh] overflow-y-auto">
                {players.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPlayerId(p.id)}
                    className={`text-left px-3 py-2 rounded-lg border font-bold text-[13px] ${
                      selectedPlayerId === p.id ? "border-orange bg-orange/10 text-orange" : "border-line bg-white text-ink"
                    }`}
                  >
                    #{p.number ?? "-"} {playerFullName(p)}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4">
              <FieldLabel>目標点</FieldLabel>
              <div className="flex gap-1.5">
                {SHOOTING_DRILL_TARGET_OPTIONS.map((t) => (
                  <SegButton key={t} active={targetPoints === t} onClick={() => setTargetPoints(t)}>
                    {t}点
                  </SegButton>
                ))}
              </div>
            </div>

            <SubmitButton onClick={handleStart} disabled={!selectedPlayerId}>
              スタート
            </SubmitButton>
          </Card>

          <button
            type="button"
            onClick={() => setManualOpen((v) => !v)}
            className="w-full mt-4 text-center py-2 rounded-lg font-bold text-[12px] border border-line text-ink-soft bg-white"
          >
            {manualOpen ? "手入力を閉じる" : "手入力で記録する(紙の記録の取り込み)"}
          </button>

          {manualOpen && (
            <Card className="mt-2">
              <FieldLabel>選手</FieldLabel>
              <select
                className={inputClass()}
                value={manualPlayerId ?? ""}
                onChange={(e) => setManualPlayerId(e.target.value || null)}
              >
                <option value="">選択してください</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.number ?? "-"} {playerFullName(p)}
                  </option>
                ))}
              </select>

              <FieldLabel>日付</FieldLabel>
              <input type="date" className={inputClass()} value={manualDate} onChange={(e) => setManualDate(e.target.value)} />

              <FieldLabel>到達タイム(目標21点固定)</FieldLabel>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  className={inputClass("!w-20")}
                  placeholder="分"
                  value={manualMin}
                  onChange={(e) => setManualMin(e.target.value)}
                />
                <span className="text-[12px] text-ink-soft">分</span>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  className={inputClass("!w-20")}
                  placeholder="秒"
                  value={manualSec}
                  onChange={(e) => setManualSec(e.target.value)}
                />
                <span className="text-[12px] text-ink-soft">秒</span>
              </div>

              {(
                [
                  ["3P", manualThreeMade, setManualThreeMade, manualThreeAtt, setManualThreeAtt],
                  ["ミドル", manualMidMade, setManualMidMade, manualMidAtt, setManualMidAtt],
                  ["ゴール下", manualLayupMade, setManualLayupMade, manualLayupAtt, setManualLayupAtt],
                ] as const
              ).map(([label, made, setMade, att, setAtt]) => (
                <div key={label} className="mt-2">
                  <FieldLabel>{label}(成功/本数)</FieldLabel>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} className={inputClass("!w-20")} value={made} onChange={(e) => setMade(e.target.value)} />
                    <span className="text-[12px] text-ink-soft">/</span>
                    <input type="number" min={0} className={inputClass("!w-20")} value={att} onChange={(e) => setAtt(e.target.value)} />
                  </div>
                </div>
              ))}

              <div className="text-[11px] text-ink-soft mt-3">総得点(自動計算): {manualTotal}点</div>

              <SubmitButton onClick={handleManualSave} disabled={manualSaving}>
                {manualSaving ? "保存中…" : "この記録を保存"}
              </SubmitButton>
            </Card>
          )}
        </>
      ) : (
        <>
          <Card>
            <div className="text-center">
              <div className="text-[12px] text-ink-soft font-bold">
                {selectedPlayer ? `#${selectedPlayer.number ?? "-"} ${playerFullName(selectedPlayer)}` : ""} / 目標{targetPoints}点
              </div>
              <div className="font-mono text-[44px] font-bold mt-1 tabular-nums">{formatElapsed(elapsedMs)}</div>
              <div className="font-mono text-[20px] font-bold text-orange mt-1">{summary.total_points}点</div>
            </div>

            {phase === "running" && upcoming && (
              <div className="mt-4">
                <div className="text-center text-[13px] font-bold text-ink-soft mb-2">
                  次: <span className="text-orange text-[18px]">{CATEGORY_LABEL[upcoming]}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleShot(true)}
                    className="py-8 rounded-xl border-2 border-orange bg-orange text-white font-extrabold text-[28px]"
                  >
                    ○ 決まった
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShot(false)}
                    className="py-8 rounded-xl border-2 border-line bg-white text-ink-soft font-extrabold text-[28px]"
                  >
                    × 外れた
                  </button>
                </div>
              </div>
            )}

            {phase === "done" && (
              <div className="mt-4 grid grid-cols-2 gap-y-2 text-[12.5px]">
                <div className="text-ink-soft">{targetPoints}点到達タイム</div>
                <div className="text-right font-mono font-bold">{formatElapsed(elapsedMs)}</div>
                <div className="text-ink-soft">3P</div>
                <div className="text-right font-mono">
                  {summary.three_made}/{summary.three_att}
                </div>
                <div className="text-ink-soft">ミドル</div>
                <div className="text-right font-mono">
                  {summary.mid_made}/{summary.mid_att}
                </div>
                <div className="text-ink-soft">ゴール下</div>
                <div className="text-right font-mono">
                  {summary.layup_made}/{summary.layup_att}
                </div>
                <div className="text-ink-soft font-bold">総得点</div>
                <div className="text-right font-mono font-bold">{summary.total_points}点</div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                type="button"
                onClick={handleUndo}
                disabled={shots.length === 0}
                className={`py-2.5 rounded-lg font-bold text-[12.5px] border border-dashed border-danger text-danger bg-white ${
                  shots.length === 0 ? "opacity-40" : ""
                }`}
              >
                1本戻す
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="py-2.5 rounded-lg font-bold text-[12.5px] border border-line text-ink-soft bg-white"
              >
                リセット
              </button>
            </div>

            {phase === "done" && (
              <SubmitButton onClick={handleSave} disabled={saving}>
                {saving ? "保存中…" : "この記録を保存"}
              </SubmitButton>
            )}
          </Card>
        </>
      )}
    </PageShell>
  );
}
