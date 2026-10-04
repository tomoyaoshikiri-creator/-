"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { Fab } from "@/components/ui/Modal";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { InlineSelect } from "@/components/ui/InlineSelect";
import { canRecordShootingDrill } from "@/lib/permissions";
import { hasShootingDrillAccess } from "@/lib/plan";
import { SHOOTING_DRILL_TARGET_OPTIONS, totalPointsFromCounts } from "@/lib/shootingDrill";
import { formatFullDateLabel, playerFullName, sortPlayers } from "@/lib/format";
import type { Player, ShootingDrillRecord } from "@/lib/database.types";

type EditDraft = {
  recorded_on: string;
  target_points: string;
  time_sec: string;
  three_made: string;
  three_att: string;
  mid_made: string;
  mid_att: string;
  layup_made: string;
  layup_att: string;
};

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = (sec - m * 60).toFixed(1);
  return m > 0 ? `${m}分${s}秒` : `${s}秒`;
}

function draftFromRecord(r: ShootingDrillRecord): EditDraft {
  return {
    recorded_on: r.recorded_on,
    target_points: String(r.target_points),
    time_sec: String(r.time_sec),
    three_made: String(r.three_made),
    three_att: String(r.three_att),
    mid_made: String(r.mid_made),
    mid_att: String(r.mid_att),
    layup_made: String(r.layup_made),
    layup_att: String(r.layup_att),
  };
}

export default function ShootingDrillListPage() {
  const router = useRouter();
  const { role, plan } = useSession();
  const toast = useToast();
  const canRecord = canRecordShootingDrill(role);

  useEffect(() => {
    if (!hasShootingDrillAccess(plan)) router.replace("/karte/team/workout");
  }, [plan, router]);

  const [players, setPlayers] = useState<Player[]>([]);
  const [records, setRecords] = useState<ShootingDrillRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [playerFilter, setPlayerFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!hasShootingDrillAccess(plan)) return;
    setLoading(true);
    const supabase = createClient();
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("players").select("*"),
      supabase.from("shooting_drill_records").select("*").order("recorded_on", { ascending: false }).order("created_at", { ascending: false }),
    ]);
    setPlayers(sortPlayers(p ?? []));
    setRecords(r ?? []);
    setLoading(false);
  }, [plan]);

  useEffect(() => {
    load();
  }, [load]);

  const playerName = (id: string) => {
    const p = players.find((pl) => pl.id === id);
    return p ? `#${p.number ?? "-"} ${playerFullName(p)}` : "-";
  };

  // 記録に登場する選手だけを絞り込み選択肢にする(保護者には自分の子の記録しか
  // RLS経由で見えないため、自然にその子だけが選択肢になる)。
  const playerIdsInRecords = Array.from(new Set(records.map((r) => r.player_id)));
  const filterOptions = [
    { value: "all", label: "すべて" },
    ...sortPlayers(players.filter((p) => playerIdsInRecords.includes(p.id))).map((p) => ({
      value: p.id,
      label: `#${p.number ?? "-"} ${playerFullName(p)}`,
    })),
  ];

  const filteredRecords = playerFilter === "all" ? records : records.filter((r) => r.player_id === playerFilter);

  // ベストタイム表(目標21点の記録のみ対象)。選手ごとにベスト(最速)・前回(最新)・
  // 回数・シュート率(成功本数合計/本数合計)を算出し、ベスト順に並べる。
  const target21Records = records.filter((r) => r.target_points === 21);
  const bestTimeRows = playerIdsInRecords
    .map((playerId) => {
      const own = target21Records.filter((r) => r.player_id === playerId);
      if (own.length === 0) return null;
      const best = own.reduce((a, b) => (a.time_sec <= b.time_sec ? a : b));
      const last = own.reduce((a, b) => (a.recorded_on + a.created_at >= b.recorded_on + b.created_at ? a : b));
      const madeTotal = own.reduce((sum, r) => sum + r.three_made + r.mid_made + r.layup_made, 0);
      const attTotal = own.reduce((sum, r) => sum + r.three_att + r.mid_att + r.layup_att, 0);
      return {
        playerId,
        best,
        last,
        count: own.length,
        shotPct: attTotal > 0 ? Math.round((madeTotal / attTotal) * 100) : null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .filter((row) => playerFilter === "all" || row.playerId === playerFilter)
    .sort((a, b) => a.best.time_sec - b.best.time_sec);

  function openRow(r: ShootingDrillRecord) {
    if (expandedId === r.id) {
      setExpandedId(null);
      setEditDraft(null);
      return;
    }
    setExpandedId(r.id);
    setEditDraft(draftFromRecord(r));
  }

  async function handleSaveEdit(id: string) {
    if (!editDraft) return;
    const three_made = Number(editDraft.three_made);
    const three_att = Number(editDraft.three_att);
    const mid_made = Number(editDraft.mid_made);
    const mid_att = Number(editDraft.mid_att);
    const layup_made = Number(editDraft.layup_made);
    const layup_att = Number(editDraft.layup_att);
    const time_sec = Number(editDraft.time_sec);
    const target_points = Number(editDraft.target_points);
    if (
      [three_made, three_att, mid_made, mid_att, layup_made, layup_att, time_sec, target_points].some((n) => Number.isNaN(n)) ||
      three_made > three_att ||
      mid_made > mid_att ||
      layup_made > layup_att ||
      time_sec <= 0
    ) {
      toast("入力内容を確認してください");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("shooting_drill_records")
      .update({
        recorded_on: editDraft.recorded_on,
        target_points,
        time_sec,
        three_made,
        three_att,
        mid_made,
        mid_att,
        layup_made,
        layup_att,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    setSaving(false);
    if (error || !data) {
      toast(`更新に失敗しました: ${error?.message ?? ""}`);
      return;
    }
    setRecords((prev) => prev.map((r) => (r.id === id ? data : r)));
    setExpandedId(null);
    setEditDraft(null);
    toast("記録を修正しました");
  }

  function handleDeleteClick(id: string) {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      setTimeout(() => setDeleteConfirmId((cur) => (cur === id ? null : cur)), 3000);
      return;
    }
    setDeleteConfirmId(null);
    (async () => {
      const supabase = createClient();
      const { error } = await supabase.from("shooting_drill_records").delete().eq("id", id);
      if (error) {
        toast(`削除に失敗しました: ${error.message}`);
        return;
      }
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setExpandedId(null);
      toast("記録を削除しました");
    })();
  }

  return (
    <PageShell
      header={<AppHeader title="コービーシューティング" variant="list" backHref="/karte/team/workout" accessBadge={canRecord ? "coach" : undefined} />}
      fab={canRecord && <Fab onClick={() => router.push("/karte/team/shooting/new")} label="計測する" />}
    >
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : (
        <>
          <div className="mb-3">
            <FieldLabel>選手で絞り込む</FieldLabel>
            <InlineSelect value={playerFilter} onChange={setPlayerFilter} options={filterOptions} />
          </div>

          <SectionLabel>ベストタイム(目標21点)</SectionLabel>
          {bestTimeRows.length === 0 ? (
            <Card>
              <EmptyState>まだ目標21点の記録がありません</EmptyState>
            </Card>
          ) : (
            <div className="bg-white border border-line rounded-lg overflow-auto mb-3">
              <table className="border-collapse text-[11.5px] w-full">
                <thead>
                  <tr className="bg-paper">
                    <th className="text-left px-2.5 py-2 border-b border-line whitespace-nowrap">選手</th>
                    <th className="px-2 py-2 border-b border-line whitespace-nowrap">ベスト</th>
                    <th className="px-2 py-2 border-b border-line whitespace-nowrap">前回</th>
                    <th className="px-2 py-2 border-b border-line whitespace-nowrap">回数</th>
                    <th className="px-2 py-2 border-b border-line whitespace-nowrap">シュート率</th>
                  </tr>
                </thead>
                <tbody>
                  {bestTimeRows.map((row) => (
                    <tr key={row.playerId}>
                      <td className="px-2.5 py-2 whitespace-nowrap border-b border-line last:border-b-0 font-bold">
                        {playerName(row.playerId)}
                      </td>
                      <td className="px-2 py-2 text-center font-mono font-bold text-orange border-b border-line last:border-b-0 whitespace-nowrap">
                        {formatTime(row.best.time_sec)}
                      </td>
                      <td className="px-2 py-2 text-center font-mono border-b border-line last:border-b-0 whitespace-nowrap">
                        {formatTime(row.last.time_sec)}
                      </td>
                      <td className="px-2 py-2 text-center font-mono border-b border-line last:border-b-0">{row.count}</td>
                      <td className="px-2 py-2 text-center font-mono border-b border-line last:border-b-0">
                        {row.shotPct === null ? "-" : `${row.shotPct}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <SectionLabel>すべての記録</SectionLabel>
          {filteredRecords.length === 0 ? (
            <Card>
              <EmptyState>記録がありません</EmptyState>
            </Card>
          ) : (
            <Card className="max-h-[50vh] overflow-y-auto">
              {filteredRecords.map((r) => {
                const expanded = expandedId === r.id;
                return (
                  <div key={r.id} className="border-b border-line last:border-b-0">
                    <button
                      type="button"
                      onClick={() => canRecord && openRow(r)}
                      className="w-full text-left py-2 text-[11.5px] leading-tight flex items-center justify-between gap-2"
                    >
                      <div>
                        <span className="font-mono text-ink-soft mr-1.5">{formatFullDateLabel(r.recorded_on)}</span>
                        <span className="font-bold">{playerName(r.player_id)}</span>
                        <span className="text-ink-soft ml-1.5">
                          目標{r.target_points}点 / {formatTime(r.time_sec)} / {r.total_points}点
                        </span>
                      </div>
                      <span className="flex-none font-mono text-[10px] text-ink-soft">
                        3P {r.three_made}/{r.three_att} ミ {r.mid_made}/{r.mid_att} 下 {r.layup_made}/{r.layup_att}
                      </span>
                    </button>

                    {expanded && editDraft && canRecord && (
                      <div className="pb-3">
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div>
                            <FieldLabel>日付</FieldLabel>
                            <input
                              type="date"
                              className={inputClass()}
                              value={editDraft.recorded_on}
                              onChange={(e) => setEditDraft((d) => d && { ...d, recorded_on: e.target.value })}
                            />
                          </div>
                          <div>
                            <FieldLabel>目標点</FieldLabel>
                            <select
                              className={inputClass()}
                              value={editDraft.target_points}
                              onChange={(e) => setEditDraft((d) => d && { ...d, target_points: e.target.value })}
                            >
                              {SHOOTING_DRILL_TARGET_OPTIONS.map((t) => (
                                <option key={t} value={t}>
                                  {t}点
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="mb-2">
                          <FieldLabel>到達タイム(秒)</FieldLabel>
                          <input
                            type="number"
                            step="0.1"
                            className={inputClass()}
                            value={editDraft.time_sec}
                            onChange={(e) => setEditDraft((d) => d && { ...d, time_sec: e.target.value })}
                          />
                        </div>
                        {(
                          [
                            ["3P", "three_made", "three_att"],
                            ["ミドル", "mid_made", "mid_att"],
                            ["ゴール下", "layup_made", "layup_att"],
                          ] as const
                        ).map(([label, madeKey, attKey]) => (
                          <div key={label} className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-2 mb-1.5">
                            <span className="text-[11px] font-bold text-ink-soft w-12">{label}</span>
                            <input
                              type="number"
                              min={0}
                              className={inputClass()}
                              value={editDraft[madeKey]}
                              onChange={(e) => setEditDraft((d) => d && { ...d, [madeKey]: e.target.value })}
                            />
                            <span className="text-[11px] text-ink-soft">/</span>
                            <input
                              type="number"
                              min={0}
                              className={inputClass()}
                              value={editDraft[attKey]}
                              onChange={(e) => setEditDraft((d) => d && { ...d, [attKey]: e.target.value })}
                            />
                          </div>
                        ))}
                        <div className="text-[11px] text-ink-soft mb-2">
                          総得点(自動計算):{" "}
                          {totalPointsFromCounts({
                            three_made: Number(editDraft.three_made) || 0,
                            mid_made: Number(editDraft.mid_made) || 0,
                            layup_made: Number(editDraft.layup_made) || 0,
                          })}
                          点
                        </div>
                        <SubmitButton onClick={() => handleSaveEdit(r.id)} disabled={saving}>
                          {saving ? "保存中…" : "保存する"}
                        </SubmitButton>
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(r.id)}
                          className="w-full mt-2 text-center py-1.5 rounded-lg font-bold text-[11.5px] border bg-white"
                          style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                        >
                          {deleteConfirmId === r.id ? "もう一度タップで削除確定" : "この記録を削除"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>
          )}
        </>
      )}
    </PageShell>
  );
}
