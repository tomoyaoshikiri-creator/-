"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState } from "@/components/ui/Card";
import { ChevronRightIcon } from "@/components/icons";
import { Fab } from "@/components/ui/Modal";
import { PlayerRow } from "@/components/PlayerRow";
import { hasCachedValue, useCachedState } from "@/lib/pageCache";
import { canManagePlayers } from "@/lib/permissions";
import { playerLimitForPlan } from "@/lib/plan";
import { useUpgradePrompt } from "@/components/PlanLock";
import { sortPlayers } from "@/lib/format";
import { computeUnseenPlayerNoteIds } from "@/lib/itemBadges";
import type { Player } from "@/lib/database.types";
import { NewPlayerModal } from "./NewPlayerModal";

export default function PlayersPage() {
  const { role, userId, plan } = useSession();
  const isStaff = canManagePlayers(role);
  const toast = useToast();
  const promptUpgrade = useUpgradePrompt();
  const cacheKey = useCallback((field: string) => `players:${userId}:${field}`, [userId]);
  const [players, setPlayers] = useCachedState<Player[]>(cacheKey("players"), []);
  const [noteCounts, setNoteCounts] = useCachedState<Record<string, number>>(cacheKey("noteCounts"), {});
  const [unseenNoteIds, setUnseenNoteIds] = useCachedState<Set<string>>(cacheKey("unseenNoteIds"), new Set());
  const [ownPlayerIds, setOwnPlayerIds] = useCachedState<Set<string>>(cacheKey("ownPlayerIds"), new Set());
  const [loading, setLoading] = useState(() => !hasCachedValue(cacheKey("players")));
  const [modalOpen, setModalOpen] = useState(false);
  const [yearConfirm, setYearConfirm] = useState(false);
  const yearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!hasCachedValue(cacheKey("players"))) setLoading(true);
    const { data: p } = await supabase.from("players").select("*");
    const list = sortPlayers(p ?? []);
    setPlayers(list);
    // メモは指導者・管理者専用の情報なので、それ以外のロール(保護者)では取得しない。
    if (list.length > 0 && isStaff) {
      const { data: notes } = await supabase.from("player_notes").select("player_id");
      const counts: Record<string, number> = {};
      (notes ?? []).forEach((n) => {
        counts[n.player_id] = (counts[n.player_id] ?? 0) + 1;
      });
      setNoteCounts(counts);
    } else {
      setNoteCounts({});
    }
    // 保護者(一般・運営)は一覧にチーム全選手が出るが、自分の子ども以外は選べないようにするため、
    // 自分の紐付け(player_guardians)だけ別途取得しておく。
    if (!isStaff) {
      const { data: pg } = await supabase.from("player_guardians").select("player_id").eq("profile_id", userId);
      setOwnPlayerIds(new Set((pg ?? []).map((g) => g.player_id)));
    } else {
      setOwnPlayerIds(new Set());
    }
    if (list.length > 0 && isStaff) {
      computeUnseenPlayerNoteIds(userId).then(setUnseenNoteIds);
    } else {
      setUnseenNoteIds(new Set());
    }
    setLoading(false);
  }, [isStaff, userId, cacheKey, setPlayers, setNoteCounts, setOwnPlayerIds, setUnseenNoteIds]);

  useEffect(() => {
    load();
  }, [load]);

  const activeList = players.filter((p) => p.status !== "OB・OG");
  const obogList = players.filter((p) => p.status === "OB・OG");
  const playerLimit = playerLimitForPlan(plan);
  const atLimit = playerLimit !== null && activeList.length >= playerLimit;

  function handleAddClick() {
    if (atLimit) {
      promptUpgrade(`Freeプランでは選手登録は${playerLimit}人までです`);
      return;
    }
    setModalOpen(true);
  }

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
      header={<AppHeader title="選手一覧" variant="detail" backHref="/team" accessBadge={isStaff ? "coach" : undefined} />}
      fab={
        isStaff && (
          <>
            <Fab onClick={handleAddClick} />
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
        )
      }
    >
      <div className="flex items-center justify-between mb-2.5">
        <div className="font-mono text-[11px] tracking-widest uppercase text-ink-soft">
          選手マスタ({activeList.length}{playerLimit !== null ? `/${playerLimit}` : ""}名)
        </div>
        {role === "管理者" && (
          <button
            type="button"
            onClick={handleYearUpdate}
            className="flex-none px-2.5 py-1.5 text-[11px] font-bold border border-line rounded-lg bg-paper text-ink-soft"
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
          activeList.map((p) => (
            <PlayerRow
              key={p.id}
              player={p}
              noteCount={noteCounts[p.id] ?? 0}
              showNotes={isStaff}
              selectable={isStaff || ownPlayerIds.has(p.id)}
              hasUnseenNotes={unseenNoteIds.has(p.id)}
            />
          ))
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
