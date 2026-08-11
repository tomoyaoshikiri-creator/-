"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { formatDateLabel, playerFullName, todayDateStr } from "@/lib/format";
import type { Player, PlayerGrowthRecord } from "@/lib/database.types";

export default function PlayerGrowthPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { userId, role } = useSession();
  const toast = useToast();

  const [player, setPlayer] = useState<Player | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [records, setRecords] = useState<PlayerGrowthRecord[]>([]);
  const [measuredOn, setMeasuredOn] = useState(todayDateStr());
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("players").select("*").eq("id", params.id).single();
      setPlayer(data ?? null);
    })();
  }, [params.id]);

  useEffect(() => {
    (async () => {
      const isStaff = role === "指導者" || role === "管理者";
      if (isStaff) {
        setAuthorized(true);
        return;
      }
      const supabase = createClient();
      const { data: link } = await supabase
        .from("player_guardians")
        .select("id")
        .eq("player_id", params.id)
        .eq("profile_id", userId)
        .maybeSingle();
      if (link) {
        setAuthorized(true);
      } else {
        setAuthorized(false);
        router.replace("/players");
      }
    })();
  }, [role, userId, params.id, router]);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("player_growth_records")
      .select("*")
      .eq("player_id", params.id)
      .order("measured_on", { ascending: false });
    setRecords(data ?? []);
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    if (authorized) load();
  }, [authorized, load]);

  async function handleSave() {
    if (!player) return;
    if (!heightCm.trim() && !weightKg.trim()) {
      toast("身長か体重のどちらかを入力してください");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("player_growth_records").upsert(
      {
        team_id: player.team_id,
        player_id: params.id,
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

  if (!authorized) return null;

  return (
    <PageShell
      header={
        <AppHeader
          title={player ? `${playerFullName(player)} / 身長・体重` : "身長・体重"}
          variant="detail"
          backHref={`/players/${params.id}`}
        />
      }
    >
      <SectionLabel>記録を追加</SectionLabel>
      <Card>
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
      </Card>

      <SectionLabel>これまでの記録</SectionLabel>
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : records.length === 0 ? (
        <EmptyState>まだ記録がありません</EmptyState>
      ) : (
        <Card>
          {records.map((r, idx) => (
            <div
              key={r.id}
              className={`flex items-center justify-between py-2 ${
                idx < records.length - 1 ? "border-b border-line" : ""
              }`}
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
        </Card>
      )}
    </PageShell>
  );
}
