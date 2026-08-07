"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { inputClass } from "@/components/ui/SegButton";
import { gradeLabel, obogCohortLabel, playerFullName } from "@/lib/format";
import type { Player, PlayerNote, PlayerStatus } from "@/lib/database.types";

const STATUS_OPTIONS: PlayerStatus[] = ["在籍", "休部", "退団", "OB・OG"];

export default function PlayerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [player, setPlayer] = useState<Player | null>(null);
  const [notes, setNotes] = useState<PlayerNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    const [{ data: p }, { data: n }] = await Promise.all([
      supabase.from("players").select("*").eq("id", params.id).single(),
      supabase
        .from("player_notes")
        .select("*")
        .eq("player_id", params.id)
        .order("created_at", { ascending: false }),
    ]);
    setPlayer(p ?? null);
    setNotes(n ?? []);
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStatusChange(status: PlayerStatus) {
    if (!player) return;
    const supabase = createClient();
    const { error } = await supabase.from("players").update({ status }).eq("id", player.id);
    if (error) {
      toast(`更新に失敗しました: ${error.message}`);
      return;
    }
    toast("ステータスを更新しました");
    load();
  }

  async function handleDelete() {
    if (!player) return;
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(false), 3000);
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("players").delete().eq("id", player.id);
    if (error) {
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    toast("選手を削除しました");
    router.push("/players");
  }

  return (
    <PageShell
      header={
        <AppHeader
          title={player ? playerFullName(player) : "選手"}
          variant="detail"
          backHref={player?.status === "OB・OG" ? "/players/obog" : "/players"}
        />
      }
    >
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : !player ? (
        <EmptyState>選手が見つかりません</EmptyState>
      ) : (
        <>
          <SectionLabel>基本情報</SectionLabel>
          <Card>
            <div className="text-xs text-ink-soft">
              {player.sei_kana ?? ""}
              {player.mei_kana ?? ""}
            </div>
            <div className="text-xs text-ink-soft mt-1">
              背番号 {player.number ?? "-"} /{" "}
              {player.status === "OB・OG" ? obogCohortLabel(player.grade) : gradeLabel(player.grade)}
            </div>
            <div className="text-xs text-ink-soft mt-1">
              {player.positions.length > 0 ? player.positions.join("・") : "ポジション未設定"}
            </div>
          </Card>

          <SectionLabel>ステータス</SectionLabel>
          <Card>
            <select
              className={inputClass()}
              value={player.status}
              onChange={(e) => handleStatusChange(e.target.value as PlayerStatus)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Card>

          <SectionLabel>メモ</SectionLabel>
          <Card>
            {notes.length === 0 ? (
              <div className="text-xs text-ink-soft">まだメモがありません</div>
            ) : (
              notes.map((n) => (
                <div key={n.id} className="text-xs text-ink-soft mb-1.5 last:mb-0">
                  {n.created_at.slice(0, 10)}: {n.body}
                </div>
              ))
            )}
          </Card>

          <div className="font-mono text-[11px] tracking-widest uppercase text-ink-soft mt-4 mb-2.5">削除</div>
          <Card>
            <button
              type="button"
              onClick={handleDelete}
              className="w-full text-center py-2 rounded-[10px] font-bold text-[12.5px] border bg-white"
              style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
            >
              {deleteConfirm ? "もう一度タップで削除確定" : "この選手を削除する"}
            </button>
          </Card>
        </>
      )}
    </PageShell>
  );
}
