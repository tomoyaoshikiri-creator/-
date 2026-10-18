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
  const total = Math.round(sec);
  const m = Math.floor(total / 60);
  const s = total - m * 60;
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
      toast.warning("入力内容を確認してください");
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
      toast.error(`更新に失敗しました: ${error?.message ?? ""}`);
      return;
    }
    setRecords((prev) => prev.map((r) => (r.id === id ? data : r)));
    setExpandedId(null);
    setEditDraft(null);
    toast.success("記録を修正しました");
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
        toast.error(`削除に失敗しました: ${error.message}`);
        return;
      }
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setExpandedId(null);
      toast.success("記録を削除しました");
    })();
  }

  return (
    <PageShell
      header={<AppHeader title="コービーシューティング" variant="list" backHref="/karte/team/workout" accessBadge={canRecord ? "coach" : undefined} />}
      fab={canRecord && expandedId === null && <Fab onClick={() => router.push("/karte/team/shooting/new")} label="計測する" />}
    >
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : (
        <>
          <div className="mb-3">
            <FieldLabel>選手で絞り込む</FieldLabel>
            <InlineSelect value={playerFilter} onChange={setPlayerFilter} options={filterOptions} />
          </div>

          <SectionLabel>すべての記録</SectionLabel>
          {filteredRecords.length === 0 ? (
            <Card>
              <EmptyState>記録がありません</EmptyState>
            </Card>
          ) : (
            <Card className="max-h-[50vh] overflow-y-auto">
              {filteredRecords.map((r) => {
                const expanded = expandedId === r.id;
                const totalMade = r.three_made + r.mid_made + r.layup_made;
                const totalAtt = r.three_att + r.mid_att + r.layup_att;
                const shotPct = totalAtt > 0 ? Math.round((totalMade / totalAtt) * 100) : null;
                return (
                  <div key={r.id} className="border-b border-line last:border-b-0">
                    <button
                      type="button"
                      onClick={() => canRecord && openRow(r)}
                      className="w-full text-left py-2 text-[11.5px] leading-tight"
                    >
                      <div>
                        <span className="font-mono text-ink-soft mr-1.5">{formatFullDateLabel(r.recorded_on)}</span>
                        <span className="font-bold">{playerName(r.player_id)}</span>
                      </div>
                      <div className="text-ink-soft mt-0.5">
                        基準{r.target_points}点 / {formatTime(r.time_sec)} / {r.total_points}点
                      </div>
                      <div className="font-mono text-[11px] text-ink-soft mt-0.5">
                        ロ {r.three_made}/{r.three_att} ミ {r.mid_made}/{r.mid_att} 下 {r.layup_made}/{r.layup_att}
                        {shotPct !== null && <span className="ml-1.5 font-bold text-orange-text">{shotPct}%</span>}
                      </div>
                    </button>

                    {expanded && editDraft && canRecord && (
                      <div className="pb-3">
                        <div className="mb-2">
                          <FieldLabel>日付</FieldLabel>
                          <input
                            type="date"
                            className={inputClass()}
                            value={editDraft.recorded_on}
                            onChange={(e) => setEditDraft((d) => d && { ...d, recorded_on: e.target.value })}
                          />
                        </div>
                        <div className="mb-2">
                          <FieldLabel>基準点</FieldLabel>
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
                            ["ロング", "three_made", "three_att"],
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
                          style={{ color: "var(--danger-text)", borderColor: "var(--danger)" }}
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
