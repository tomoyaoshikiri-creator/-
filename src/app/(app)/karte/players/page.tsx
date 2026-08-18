"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { ChevronRightIcon } from "@/components/icons";
import { KartePlayerRow } from "@/components/KartePlayerRow";
import { canViewKarte } from "@/lib/permissions";
import { hasKarteTabAccess } from "@/lib/plan";
import { computeUnseenPlayerAnalysisIds } from "@/lib/itemBadges";
import { fiscalYearOf, sortPlayers, todayDateStr } from "@/lib/format";
import type { Player } from "@/lib/database.types";
import { buildBulkPlayerCopyText } from "@/lib/ai/buildCopyText";
import { collectPlayerAnalysisData } from "@/lib/ai/collect";
import { planKindFor, type PlayerAnalysisData } from "@/lib/ai/types";

const CURRENT_FISCAL_YEAR = fiscalYearOf(todayDateStr());

export default function KartePlayersPage() {
  const router = useRouter();
  const { role, userId, plan, sport } = useSession();
  const toast = useToast();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [unseenAnalysisIds, setUnseenAnalysisIds] = useState<Set<string>>(new Set());

  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisPrompt, setAnalysisPrompt] = useState("");
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisPlayersData, setAnalysisPlayersData] = useState<PlayerAnalysisData[] | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("players").select("*");
      setPlayers(sortPlayers(data ?? []));
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    computeUnseenPlayerAnalysisIds(userId).then(setUnseenAnalysisIds);
  }, [userId]);

  useEffect(() => {
    if (!canViewKarte(role) || !hasKarteTabAccess(plan)) router.replace("/schedule");
  }, [role, plan, router]);

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
          collectPlayerAnalysisData(supabase, { playerId: player.id, fiscalYear: CURRENT_FISCAL_YEAR, sport, planKind }),
        ),
      );
      setAnalysisPlayersData(playersData);
    } finally {
      setAnalysisLoading(false);
    }
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
      header={<AppHeader title="選手カルテ" variant="detail" backHref="/karte" accessBadge="coach" />}
    >
      {role === "管理者" && (
        <div className="flex items-center justify-end mb-2">
          <button
            type="button"
            onClick={handleOpenAnalysis}
            className="flex-none px-3 py-1.5 rounded-[10px] border border-orange text-[11px] font-bold text-orange bg-orange/8"
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
            <KartePlayerRow key={p.id} player={p} hasUnseenAnalysis={unseenAnalysisIds.has(p.id)} />
          ))
        )}
      </Card>

      {!loading && obogList.length > 0 && (
        <Link href="/karte/players/obog">
          <Card className="cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="font-bold text-[13.5px]">OB・OG({obogList.length}名)</div>
              <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
            </div>
          </Card>
        </Link>
      )}

      {role === "管理者" && (
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
