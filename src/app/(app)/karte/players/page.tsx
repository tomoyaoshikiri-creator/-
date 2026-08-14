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
import { NumChip } from "@/components/ui/Pill";
import { ChevronRightIcon } from "@/components/icons";
import { canViewKarte } from "@/lib/permissions";
import { computeUnseenPlayerAnalysisIds } from "@/lib/itemBadges";
import {
  buildBulkKarteAnalysisText,
  computeSeasonAverages,
  DEFAULT_KARTE_ANALYSIS_PROMPT,
  type PlayerKarteBodyParams,
} from "@/lib/karteAggregate";
import { effectiveFiscalYear, fiscalYearOf, formatDateLabel, playerFullName, sortPlayers, todayDateStr } from "@/lib/format";
import type { GamePlayerStatLine, Player, PlayerGrowthRecord, PracticeMenu, SportsTestRecord } from "@/lib/database.types";

const CURRENT_FISCAL_YEAR = fiscalYearOf(todayDateStr());

interface StatLineWithDate extends GamePlayerStatLine {
  game_matches: { opponent: string | null; schedules: { date: string; fiscal_year_override: number | null } | null } | null;
}

function PlayerRow({ player, hasUnseenAnalysis }: { player: Player; hasUnseenAnalysis: boolean }) {
  return (
    <Link
      href={`/karte/players/${player.id}`}
      className="flex items-center gap-2.5 py-2.5 border-b border-line last:border-b-0"
    >
      <NumChip num={player.number ?? "-"} />
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        {hasUnseenAnalysis && <span className="w-[7px] h-[7px] rounded-full bg-danger flex-shrink-0" />}
        <span className="font-bold text-[13.5px]">{playerFullName(player)}</span>
      </div>
      <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
    </Link>
  );
}

export default function KartePlayersPage() {
  const router = useRouter();
  const { role, userId } = useSession();
  const toast = useToast();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [unseenAnalysisIds, setUnseenAnalysisIds] = useState<Set<string>>(new Set());

  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisPrompt, setAnalysisPrompt] = useState(DEFAULT_KARTE_ANALYSIS_PROMPT);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisPlayersData, setAnalysisPlayersData] = useState<PlayerKarteBodyParams[] | null>(null);

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
    if (!canViewKarte(role)) router.replace("/schedule");
  }, [role, router]);

  const activeList = players.filter((p) => p.status !== "OB・OG");
  const obogList = players.filter((p) => p.status === "OB・OG");

  async function handleOpenAnalysis() {
    setAnalysisOpen(true);
    if (analysisPlayersData !== null) return;
    setAnalysisLoading(true);
    const supabase = createClient();
    const activePlayerIds = activeList.map((p) => p.id);

    const [{ data: statLines }, { data: sportsTests }, { data: growth }, { data: practiceSchedules }] = await Promise.all([
      supabase
        .from("game_player_stat_lines")
        .select("*, game_matches(opponent, schedules(date, fiscal_year_override))")
        .in("player_id", activePlayerIds)
        .returns<StatLineWithDate[]>(),
      supabase.from("sports_test_records").select("*").in("player_id", activePlayerIds).eq("fiscal_year", CURRENT_FISCAL_YEAR),
      supabase
        .from("player_growth_records")
        .select("*")
        .in("player_id", activePlayerIds)
        .order("measured_on", { ascending: false }),
      supabase.from("schedules").select("id, date").eq("type", "practice").lte("date", todayDateStr()),
    ]);

    const yearPractices = (practiceSchedules ?? []).filter((s) => fiscalYearOf(s.date) === CURRENT_FISCAL_YEAR);
    const practiceIds = yearPractices.map((s) => s.id);

    let menus: PracticeMenu[] = [];
    let attendanceRows: { schedule_id: string; player_id: string | null }[] = [];
    if (practiceIds.length > 0) {
      const [{ data: m }, { data: a }] = await Promise.all([
        supabase.from("practice_menus").select("*").in("schedule_id", practiceIds),
        supabase
          .from("attendances")
          .select("schedule_id, player_id")
          .in("schedule_id", practiceIds)
          .in("player_id", activePlayerIds)
          .in("status", ["出席", "遅刻早退"]),
      ]);
      menus = m ?? [];
      attendanceRows = a ?? [];
    }

    const playersData = activeList.map((player) => {
      const seasonLines = (statLines ?? [])
        .filter((l) => l.player_id === player.id)
        .filter((l) => {
          const date = l.game_matches?.schedules?.date;
          if (!date) return false;
          return effectiveFiscalYear(date, l.game_matches?.schedules?.fiscal_year_override ?? null) === CURRENT_FISCAL_YEAR;
        })
        .sort((a, b) => (a.game_matches?.schedules?.date ?? "").localeCompare(b.game_matches?.schedules?.date ?? ""));
      const seasonAverages = computeSeasonAverages(seasonLines);
      const gameRows = seasonLines.map((l) => ({
        label: `${formatDateLabel(l.game_matches?.schedules?.date ?? "")} vs ${l.game_matches?.opponent ?? "-"}`,
        averages: computeSeasonAverages([l]),
      }));

      const sportsTestRecords: SportsTestRecord[] = (sportsTests ?? []).filter((r) => r.player_id === player.id);
      const growthRecords: PlayerGrowthRecord[] = (growth ?? []).filter((g) => g.player_id === player.id).slice(0, 6);

      const attendedScheduleIds = new Set(
        attendanceRows.filter((a) => a.player_id === player.id).map((a) => a.schedule_id),
      );
      const workoutTallyMap = new Map<string, number>();
      menus
        .filter((m) => attendedScheduleIds.has(m.schedule_id))
        .forEach((m) => {
          const theme = (m.theme ?? "").trim();
          if (!theme) return;
          workoutTallyMap.set(theme, (workoutTallyMap.get(theme) ?? 0) + 1);
        });
      const workoutTallies = Array.from(workoutTallyMap.entries())
        .map(([theme, count]) => ({ theme, count }))
        .sort((a, b) => b.count - a.count);

      return {
        player,
        fiscalYear: CURRENT_FISCAL_YEAR,
        seasonAverages,
        gameRows,
        sportsTestRecords,
        growthRecords,
        workoutTallies,
        attendedPracticeCount: attendedScheduleIds.size,
      };
    });

    setAnalysisPlayersData(playersData);
    setAnalysisLoading(false);
  }

  async function handleCopyAnalysis() {
    if (analysisPlayersData === null) return;
    const text = buildBulkKarteAnalysisText({
      promptText: analysisPrompt,
      players: analysisPlayersData,
    });
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
            <PlayerRow key={p.id} player={p} hasUnseenAnalysis={unseenAnalysisIds.has(p.id)} />
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
          <FieldLabel>AIへの指示文</FieldLabel>
          <textarea
            rows={3}
            className={inputClass()}
            value={analysisPrompt}
            onChange={(e) => setAnalysisPrompt(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setAnalysisPrompt(DEFAULT_KARTE_ANALYSIS_PROMPT)}
            className="text-[11px] font-bold text-orange mt-1.5"
          >
            デフォルトの文言に戻す
          </button>
          <div className="text-xs text-ink-soft mt-2.5">
            この指示文に続けて、在籍選手全員分のスタッツ・スポーツテスト・身長体重のデータが選手ごとに区切ってコピーされます
          </div>
          <SubmitButton onClick={handleCopyAnalysis} disabled={analysisLoading}>
            {analysisLoading ? "読み込み中…" : "この内容でコピーする"}
          </SubmitButton>
        </Modal>
      )}
    </PageShell>
  );
}
