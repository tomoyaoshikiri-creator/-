"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState } from "@/components/ui/Card";
import { Fab, Modal } from "@/components/ui/Modal";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { ChevronRightIcon } from "@/components/icons";
import { KartePlayerRow } from "@/components/KartePlayerRow";
import { canViewKarte } from "@/lib/permissions";
import { hasAiAnalysisAccess, hasKarteTabAccess, playerLimitForPlan } from "@/lib/plan";
import { useUpgradePrompt } from "@/components/PlanLock";
import { computeUnseenPlayerAnalysisIds } from "@/lib/itemBadges";
import { fiscalYearOf, sortPlayers, todayDateStr } from "@/lib/format";
import type { Player } from "@/lib/database.types";
import { buildBulkPlayerCopyText } from "@/lib/ai/buildCopyText";
import { collectPlayerAnalysisData } from "@/lib/ai/collect";
import { planKindFor, type PlayerAnalysisData } from "@/lib/ai/types";
import { NewPlayerModal } from "../../players/NewPlayerModal";

const CURRENT_FISCAL_YEAR = fiscalYearOf(todayDateStr());

export default function KartePlayersPage() {
  const router = useRouter();
  const { role, userId, plan, sport, category } = useSession();
  const isStaff = canViewKarte(role);
  const toast = useToast();
  const promptUpgrade = useUpgradePrompt();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [unseenAnalysisIds, setUnseenAnalysisIds] = useState<Set<string>>(new Set());
  const [ownPlayerIds, setOwnPlayerIds] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [yearConfirm, setYearConfirm] = useState(false);
  const yearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisPrompt, setAnalysisPrompt] = useState("");
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisPlayersData, setAnalysisPlayersData] = useState<PlayerAnalysisData[] | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("players").select("*");
    setPlayers(sortPlayers(data ?? []));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (isStaff) computeUnseenPlayerAnalysisIds(userId).then(setUnseenAnalysisIds);
  }, [isStaff, userId]);

  // 保護者(一般・運営)は一覧にチーム全選手が出るが、自分の子ども以外は選べないようにする
  // (players一覧側のPlayerRowと同じ方針)。
  useEffect(() => {
    if (isStaff) {
      setOwnPlayerIds(new Set());
      return;
    }
    (async () => {
      const supabase = createClient();
      const { data: pg } = await supabase.from("player_guardians").select("player_id").eq("profile_id", userId);
      setOwnPlayerIds(new Set((pg ?? []).map((g) => g.player_id)));
    })();
  }, [isStaff, userId]);

  useEffect(() => {
    if (!hasKarteTabAccess(plan)) router.replace("/home");
  }, [plan, router]);

  const activeList = players.filter((p) => p.status !== "OB・OG");
  const obogList = players.filter((p) => p.status === "OB・OG");

  async function handleOpenAnalysis() {
    setAnalysisOpen(true);
    if (analysisPlayersData !== null) return;
    setAnalysisLoading(true);
    try {
      const supabase = createClient();
      const planKind = planKindFor(plan) ?? "proAiPlus";
      const playersData = await Promise.all(
        activeList.map((player) =>
          collectPlayerAnalysisData(supabase, { playerId: player.id, fiscalYear: CURRENT_FISCAL_YEAR, sport, category, planKind }),
        ),
      );
      setAnalysisPlayersData(playersData);
    } finally {
      setAnalysisLoading(false);
    }
  }

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

  async function handleCopyAnalysis() {
    if (analysisPlayersData === null) return;
    const text = buildBulkPlayerCopyText(analysisPlayersData, analysisPrompt);
    try {
      await navigator.clipboard.writeText(text);
      toast("分析用テキストをコピーしました");
      setAnalysisOpen(false);
    } catch {
      toast("コピーに失敗しました");
    }
  }

  return (
    <PageShell
      header={<AppHeader title="選手カルテ" variant="detail" backHref="/team" accessBadge={isStaff ? "coach" : undefined} />}
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

      {role === "管理者" && hasAiAnalysisAccess(plan) && (
        <div className="flex items-center justify-end mb-2">
          <button
            type="button"
            onClick={handleOpenAnalysis}
            className="flex-none px-3 py-1.5 rounded-lg border border-orange text-[11px] font-bold text-orange bg-orange/8"
          >
            分析用抽出〈一括〉
          </button>
        </div>
      )}

      <Card>
        {loading ? (
          <EmptyState>読み込み中…</EmptyState>
        ) : activeList.length === 0 ? (
          <EmptyState>選手がいません</EmptyState>
        ) : (
          activeList.map((p) => (
            <KartePlayerRow
              key={p.id}
              player={p}
              hasUnseenAnalysis={unseenAnalysisIds.has(p.id)}
              selectable={isStaff || ownPlayerIds.has(p.id)}
            />
          ))
        )}
      </Card>

      {!loading && obogList.length > 0 && (
        // OB・OG一覧は/players/obogに統合済み(選手一覧側と重複していたため)。
        // スタッフはPlayerRowのselectableが常にtrueになるため、通常のリンクと同様に使える。
        <Link href="/players/obog">
          <Card className="cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="font-bold text-[13.5px]">OB・OG({obogList.length}名)</div>
              <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
            </div>
          </Card>
        </Link>
      )}

      {role === "管理者" && hasAiAnalysisAccess(plan) && (
        <Modal open={analysisOpen} onClose={() => setAnalysisOpen(false)} title="分析用抽出〈一括〉">
          <FieldLabel>追加で重視してほしい点(任意)</FieldLabel>
          <textarea
            rows={3}
            className={inputClass()}
            value={analysisPrompt}
            onChange={(e) => setAnalysisPrompt(e.target.value)}
            placeholder="例: 特に新入部員の定着状況を意識して見てほしい"
          />
          <div className="text-xs text-ink-soft mt-2.5">
            在籍選手全員分のスタッツ・スポーツテスト・練習参加状況・身長体重のデータと分析の観点を整理したテキストが選手ごとに区切ってコピーされます。外部のAIチャットに貼り付けて利用できます
          </div>
          <SubmitButton onClick={handleCopyAnalysis} disabled={analysisLoading}>
            {analysisLoading ? "準備中…" : "この内容でコピーする"}
          </SubmitButton>
        </Modal>
      )}
    </PageShell>
  );
}
