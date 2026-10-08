"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { Fab, Modal } from "@/components/ui/Modal";
import { FieldLabel, SegButton, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { canRecordShavingDrill } from "@/lib/permissions";
import { hasShavingDrillAccess } from "@/lib/plan";
import { SHAVING_DURATION_PRESETS, SHAVING_MOVE_LABELS, formatShavingDuration } from "@/lib/shavingDrill";
import { formatFullDateLabel, todayDateStr } from "@/lib/format";
import type { ShavingDrillRecord } from "@/lib/database.types";

type CountsDraft = { move1_count: string; move2_count: string; move3_count: string; move4_count: string };

const EMPTY_COUNTS: CountsDraft = { move1_count: "", move2_count: "", move3_count: "", move4_count: "" };
const COUNT_KEYS = ["move1_count", "move2_count", "move3_count", "move4_count"] as const;

function draftFromRecord(r: ShavingDrillRecord): CountsDraft {
  return {
    move1_count: String(r.move1_count),
    move2_count: String(r.move2_count),
    move3_count: String(r.move3_count),
    move4_count: String(r.move4_count),
  };
}

export default function ShavingDrillPage() {
  const router = useRouter();
  const { teamId, role, plan, userId } = useSession();
  const toast = useToast();
  const canRecord = canRecordShavingDrill(role);

  useEffect(() => {
    if (!hasShavingDrillAccess(plan)) router.replace("/karte/team/workout");
  }, [plan, router]);

  const [records, setRecords] = useState<ShavingDrillRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!hasShavingDrillAccess(plan)) return;
    setLoading(true);
    const supabase = createClient();
    const { data: r } = await supabase
      .from("shaving_drill_records")
      .select("*")
      .order("recorded_on", { ascending: false })
      .order("created_at", { ascending: false });
    setRecords(r ?? []);
    setLoading(false);
  }, [plan]);

  useEffect(() => {
    load();
  }, [load]);

  // 新規登録モーダル
  const [modalOpen, setModalOpen] = useState(false);
  const [formDate, setFormDate] = useState(todayDateStr());
  const [formDuration, setFormDuration] = useState<number | "custom">(180);
  const [formCustomDuration, setFormCustomDuration] = useState("");
  const [formCounts, setFormCounts] = useState<CountsDraft>(EMPTY_COUNTS);
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setFormDate(todayDateStr());
    setFormDuration(180);
    setFormCustomDuration("");
    setFormCounts(EMPTY_COUNTS);
  }

  async function handleCreate() {
    const durationSec = formDuration === "custom" ? Number(formCustomDuration) : formDuration;
    const counts = COUNT_KEYS.map((k) => Number(formCounts[k]));
    if (!Number.isInteger(durationSec) || durationSec <= 0) {
      toast("時間を正しく入力してください");
      return;
    }
    if (counts.some((n) => !Number.isInteger(n) || n < 0)) {
      toast("回数を正しく入力してください");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("shaving_drill_records")
      .insert({
        team_id: teamId,
        recorded_on: formDate,
        duration_sec: durationSec,
        move1_count: counts[0],
        move2_count: counts[1],
        move3_count: counts[2],
        move4_count: counts[3],
        recorded_by: userId,
      })
      .select("*")
      .single();
    setSaving(false);
    if (error || !data) {
      toast(`保存に失敗しました: ${error?.message ?? ""}`);
      return;
    }
    setRecords((prev) => [data, ...prev]);
    resetForm();
    setModalOpen(false);
    toast("記録を保存しました");
  }

  // 一覧の各行の編集・削除
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<CountsDraft | null>(null);
  const [editDate, setEditDate] = useState(todayDateStr());
  const [editDurationText, setEditDurationText] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  function openRow(r: ShavingDrillRecord) {
    if (expandedId === r.id) {
      setExpandedId(null);
      setEditDraft(null);
      return;
    }
    setExpandedId(r.id);
    setEditDraft(draftFromRecord(r));
    setEditDate(r.recorded_on);
    setEditDurationText(String(r.duration_sec));
  }

  async function handleSaveEdit(id: string) {
    if (!editDraft) return;
    const durationSec = Number(editDurationText);
    const counts = COUNT_KEYS.map((k) => Number(editDraft[k]));
    if (!Number.isInteger(durationSec) || durationSec <= 0 || counts.some((n) => !Number.isInteger(n) || n < 0)) {
      toast("入力内容を確認してください");
      return;
    }
    setEditSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("shaving_drill_records")
      .update({
        recorded_on: editDate,
        duration_sec: durationSec,
        move1_count: counts[0],
        move2_count: counts[1],
        move3_count: counts[2],
        move4_count: counts[3],
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    setEditSaving(false);
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
      const { error } = await supabase.from("shaving_drill_records").delete().eq("id", id);
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
      header={<AppHeader title="シェービングドリル" variant="list" backHref="/karte/team/workout" accessBadge={canRecord ? "coach" : undefined} />}
      fab={
        canRecord && (
          <>
            <Fab onClick={() => setModalOpen(true)} label="記録する" />
            <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="シェービングドリルを記録">
              <FieldLabel>日付</FieldLabel>
              <input type="date" className={inputClass()} value={formDate} onChange={(e) => setFormDate(e.target.value)} />

              <FieldLabel>時間</FieldLabel>
              <div className="flex gap-1.5 mb-2">
                {SHAVING_DURATION_PRESETS.map((d) => (
                  <SegButton key={d} active={formDuration === d} onClick={() => setFormDuration(d)}>
                    {formatShavingDuration(d)}
                  </SegButton>
                ))}
                <SegButton active={formDuration === "custom"} onClick={() => setFormDuration("custom")}>
                  任意
                </SegButton>
              </div>
              {formDuration === "custom" && (
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="number"
                    min={1}
                    className={inputClass("!w-24")}
                    placeholder="秒数"
                    value={formCustomDuration}
                    onChange={(e) => setFormCustomDuration(e.target.value)}
                  />
                  <span className="text-[12px] text-ink-soft">秒</span>
                </div>
              )}

              {SHAVING_MOVE_LABELS.map((label, i) => (
                <div key={label} className="mt-2">
                  <FieldLabel>{label}(回数)</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    className={inputClass()}
                    value={formCounts[COUNT_KEYS[i]]}
                    onChange={(e) => setFormCounts((prev) => ({ ...prev, [COUNT_KEYS[i]]: e.target.value }))}
                  />
                </div>
              ))}

              <SubmitButton onClick={handleCreate} disabled={saving}>
                {saving ? "保存中…" : "この記録を保存"}
              </SubmitButton>
            </Modal>
          </>
        )
      }
    >
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : (
        <>
          <SectionLabel>記録一覧</SectionLabel>
          {records.length === 0 ? (
            <Card>
              <EmptyState>記録がありません</EmptyState>
            </Card>
          ) : (
            <Card className="max-h-[65vh] overflow-y-auto">
              {records.map((r) => {
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
                        <span className="font-bold">{formatShavingDuration(r.duration_sec)}</span>
                      </div>
                      <span className="flex-none font-mono text-[10px] text-ink-soft">
                        {SHAVING_MOVE_LABELS[0]} {r.move1_count} / {SHAVING_MOVE_LABELS[1]} {r.move2_count} /{" "}
                        {SHAVING_MOVE_LABELS[2]} {r.move3_count} / {SHAVING_MOVE_LABELS[3]} {r.move4_count}
                      </span>
                    </button>

                    {expanded && editDraft && canRecord && (
                      <div className="pb-3">
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div>
                            <FieldLabel>日付</FieldLabel>
                            <input type="date" className={inputClass()} value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                          </div>
                          <div>
                            <FieldLabel>時間(秒)</FieldLabel>
                            <input
                              type="number"
                              min={1}
                              className={inputClass()}
                              value={editDurationText}
                              onChange={(e) => setEditDurationText(e.target.value)}
                            />
                          </div>
                        </div>
                        {SHAVING_MOVE_LABELS.map((label, i) => (
                          <div key={label} className="grid grid-cols-[auto_1fr] items-center gap-2 mb-1.5">
                            <span className="text-[11px] font-bold text-ink-soft w-12">{label}</span>
                            <input
                              type="number"
                              min={0}
                              className={inputClass()}
                              value={editDraft[COUNT_KEYS[i]]}
                              onChange={(e) => setEditDraft((d) => d && { ...d, [COUNT_KEYS[i]]: e.target.value })}
                            />
                          </div>
                        ))}
                        <SubmitButton onClick={() => handleSaveEdit(r.id)} disabled={editSaving}>
                          {editSaving ? "保存中…" : "保存する"}
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
