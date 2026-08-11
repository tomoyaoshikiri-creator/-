"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { Card, SectionLabel } from "@/components/ui/Card";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { formatDateLabel, todayDateStr } from "@/lib/format";
import type { PlayerGrowthRecord } from "@/lib/database.types";

export function PlayerGrowthCard({ playerId, teamId }: { playerId: string; teamId: string }) {
  const { userId, role } = useSession();
  const toast = useToast();

  const [canAccess, setCanAccess] = useState(false);
  const [records, setRecords] = useState<PlayerGrowthRecord[]>([]);
  const [measuredOn, setMeasuredOn] = useState(todayDateStr());
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const isStaff = role === "指導者" || role === "管理者";
    let allowed = isStaff;
    if (!isStaff) {
      const { data: link } = await supabase
        .from("player_guardians")
        .select("id")
        .eq("player_id", playerId)
        .eq("profile_id", userId)
        .maybeSingle();
      allowed = !!link;
    }
    setCanAccess(allowed);
    if (!allowed) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("player_growth_records")
      .select("*")
      .eq("player_id", playerId)
      .order("measured_on", { ascending: false });
    setRecords(data ?? []);
    setLoading(false);
  }, [playerId, userId, role]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    if (!heightCm.trim() && !weightKg.trim()) {
      toast("身長か体重のどちらかを入力してください");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("player_growth_records").upsert(
      {
        team_id: teamId,
        player_id: playerId,
        measured_on: measuredOn,
        height_cm: heightCm.trim() ? Number(heightCm) : null,
        weight_kg: weightKg.trim() ? Number(weightKg) : null,
        recorded_by: userId,
      },
      { onConflict: "player_id,measured_on" },
    );
    setSaving(false);
    if (error) {
      toast(`保存に失敗しました: ${error.message}`);
      return;
    }
    setHeightCm("");
    setWeightKg("");
    toast("記録しました");
    load();
  }

  async function handleDelete(id: string) {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      setTimeout(() => setDeleteConfirmId((cur) => (cur === id ? null : cur)), 3000);
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("player_growth_records").delete().eq("id", id);
    if (error) {
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    setDeleteConfirmId(null);
    load();
  }

  if (loading || !canAccess) return null;

  const latest = records[0];

  return (
    <>
      <SectionLabel>身長・体重(週次)</SectionLabel>
      <Card>
        {latest && (
          <div className="text-[13px] text-ink-soft mb-3">
            直近: {formatDateLabel(latest.measured_on)} 　身長 {latest.height_cm ?? "-"}cm 　体重{" "}
            {latest.weight_kg ?? "-"}kg
          </div>
        )}

        <FieldLabel>測定日</FieldLabel>
        <input
          type="date"
          className={inputClass()}
          value={measuredOn}
          onChange={(e) => setMeasuredOn(e.target.value)}
        />
        <div className="mt-3 flex gap-2">
          <div className="flex-1">
            <FieldLabel>身長(cm)</FieldLabel>
            <input
              type="number"
              step="0.1"
              min={0}
              className={inputClass()}
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <FieldLabel>体重(kg)</FieldLabel>
            <input
              type="number"
              step="0.1"
              min={0}
              className={inputClass()}
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
            />
          </div>
        </div>
        <SubmitButton onClick={handleSave} disabled={saving}>
          {saving ? "保存中…" : "記録する"}
        </SubmitButton>

        {records.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              className="text-[12px] font-bold text-orange mt-3"
            >
              {historyOpen ? "過去の記録を閉じる" : `過去の記録を見る(${records.length}件)`}
            </button>
            {historyOpen && (
              <div className="mt-2.5">
                {records.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between border-b border-line py-2 last:border-b-0"
                  >
                    <div className="text-[12.5px]">
                      {formatDateLabel(r.measured_on)} 　身長 {r.height_cm ?? "-"}cm 　体重 {r.weight_kg ?? "-"}kg
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(r.id)}
                      className={`flex-shrink-0 ml-2 px-2.5 py-1 rounded-[8px] text-[11px] font-bold border ${
                        deleteConfirmId === r.id
                          ? "border-danger text-danger bg-danger/8"
                          : "border-line text-ink-soft bg-paper"
                      }`}
                    >
                      {deleteConfirmId === r.id ? "削除確定" : "削除"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}
