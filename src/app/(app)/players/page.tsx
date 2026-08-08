"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { CurrentUserBadge } from "@/components/CurrentUserBadge";
import { Card, EmptyState } from "@/components/ui/Card";
import { NumChip } from "@/components/ui/Pill";
import { ChevronRightIcon } from "@/components/icons";
import { Fab } from "@/components/ui/Modal";
import { canAccessTab } from "@/lib/permissions";
import { gradeLabel, playerFullName, sortPlayers } from "@/lib/format";
import type { Player } from "@/lib/database.types";
import { NewPlayerModal } from "./NewPlayerModal";

function PlayerRow({ player, noteCount }: { player: Player; noteCount: number }) {
  const isObog = player.status === "OB・OG";
  return (
    <Link
      href={`/players/${player.id}`}
      className="flex items-center gap-2.5 py-2.5 border-b border-line last:border-b-0"
    >
      <NumChip num={player.number ?? "-"} muted={isObog} />
      <div className="flex-1">
        <div className="font-bold text-[13.5px]">{playerFullName(player)}</div>
        <div className="text-[11px] text-ink-soft mt-0.5">
          {gradeLabel(player.grade)}・{player.positions.join("/")} · メモ{noteCount}件 · {player.status}
        </div>
      </div>
      <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
    </Link>
  );
}

export default function PlayersPage() {
  const router = useRouter();
  const { role } = useSession();
  const toast = useToast();
  const [players, setPlayers] = useState<Player[]>([]);
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [yearConfirm, setYearConfirm] = useState(false);
  const yearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    const { data: p } = await supabase.from("players").select("*");
    const list = sortPlayers(p ?? []);
    setPlayers(list);
    if (list.length > 0) {
      const { data: notes } = await supabase.from("player_notes").select("player_id");
      const counts: Record<string, number> = {};
      (notes ?? []).forEach((n) => {
        counts[n.player_id] = (counts[n.player_id] ?? 0) + 1;
      });
      setNoteCounts(counts);
    } else {
      setNoteCounts({});
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canAccessTab(role, "players")) router.replace("/schedule");
  }, [role, router]);

  const activeList = players.filter((p) => p.status !== "OB・OG");
  const obogList = players.filter((p) => p.status === "OB・OG");

  async function handleYearUpdate() {
    if (!yearConfirm) {
      setYearConfirm(true);
      if (yearTimerRef.current) clearTimeout(yearTimerRef.current);
      yearTimerRef.current = setTimeout(() => setYearConfirm(false), 3000);
      return;
    }
    setYearConfirm(false);
    if (yearTimerRef.current) clearTimeout(yearTimerRef.current);
    const supabase = createClient();
    const { error } = await supabase.rpc("advance_academic_year");
    if (error) {
      toast(`実行に失敗しました: ${error.message}`);
      return;
    }
    toast("年度更新を実行しました");
    load();
  }

  return (
    <PageShell
      header={<AppHeader title="選手一覧" rightSlot={<CurrentUserBadge />} />}
      fab={
        <>
          <Fab onClick={() => setModalOpen(true)} />
          <NewPlayerModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            onCreated={() => {
              setModalOpen(false);
              load();
              toast("選手を登録しました");
            }}
          />
        </>
      }
    >
      <div className="flex items-center justify-between mb-2.5">
        <div className="font-mono text-[11px] tracking-widest uppercase text-ink-soft">選手マスタ</div>
        {role === "管理者" && (
          <button
            type="button"
            onClick={handleYearUpdate}
            className="flex-none px-2.5 py-1.5 text-[11px] font-bold border border-line rounded-[10px] bg-paper text-ink-soft"
          >
            {yearConfirm ? "もう一度タップで実行" : "年度更新"}
          </button>
        )}
      </div>

      <Card>
        {loading ? (
          <EmptyState>読み込み中…</EmptyState>
        ) : activeList.length === 0 ? (
          <EmptyState>選手がいません</EmptyState>
        ) : (
          activeList.map((p) => <PlayerRow key={p.id} player={p} noteCount={noteCounts[p.id] ?? 0} />)
        )}
      </Card>

      {!loading && obogList.length > 0 && (
        <Link href="/players/obog">
          <Card className="cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="font-bold text-[13.5px]">OB・OG({obogList.length}名)</div>
              <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
            </div>
          </Card>
        </Link>
      )}
    </PageShell>
  );
}
