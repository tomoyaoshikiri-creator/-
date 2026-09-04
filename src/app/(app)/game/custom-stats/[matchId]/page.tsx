"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { EmptyState } from "@/components/ui/Card";
import { canManageStatCategories, canRecordGames } from "@/lib/permissions";
import { usesDetailedBasketballStats } from "@/lib/sport";
import { playerFullName, sortPlayers } from "@/lib/format";
import type { GameMatch, GamePlayerStatEntry, Player, Schedule, TeamStatCategory } from "@/lib/database.types";

export default function CustomStatsPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = params.matchId;
  const router = useRouter();
  const { teamId, role, sport } = useSession();
  const toast = useToast();

  useEffect(() => {
    if (usesDetailedBasketballStats(sport) || !canRecordGames(role)) router.replace("/game");
  }, [sport, role, router]);

  const [match, setMatch] = useState<GameMatch | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [categories, setCategories] = useState<TeamStatCategory[]>([]);
  const [entries, setEntries] = useState<Record<string, GamePlayerStatEntry>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: m } = await supabase.from("game_matches").select("*").eq("id", matchId).single();
    setMatch(m ?? null);
    if (m) {
      const [{ data: s }, { data: p }, { data: c }, { data: e }] = await Promise.all([
        supabase.from("schedules").select("*").eq("id", m.schedule_id).single(),
        supabase.from("players").select("*").eq("status", "在籍"),
        supabase.from("team_stat_categories").select("*").order("position", { ascending: true }),
        supabase.from("game_player_stat_entries").select("*").eq("match_id", matchId),
      ]);
      setSchedule(s ?? null);
      setPlayers(sortPlayers(p ?? []));
      setCategories(c ?? []);
      const map: Record<string, GamePlayerStatEntry> = {};
      (e ?? []).forEach((entry) => {
        map[`${entry.player_id}:${entry.category_id}`] = entry;
      });
      setEntries(map);
    }
    setLoading(false);
  }, [matchId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleChange(playerId: string, categoryId: string, rawValue: string) {
    const key = `${playerId}:${categoryId}`;
    const value = rawValue === "" ? 0 : Number(rawValue);
    if (Number.isNaN(value) || value < 0) return;
    setSavingKey(key);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("game_player_stat_entries")
      .upsert(
        { team_id: teamId, match_id: matchId, player_id: playerId, category_id: categoryId, value },
        { onConflict: "match_id,player_id,category_id" },
      )
      .select()
      .single();
    setSavingKey(null);
    if (error) {
      toast(`保存に失敗しました: ${error.message}`);
      return;
    }
    if (data) setEntries((prev) => ({ ...prev, [key]: data }));
  }

  return (
    <PageShell
      header={
        <AppHeader
          title="スタッツ入力"
          variant="detail"
          backHref={schedule ? `/game/${schedule.id}` : "/game"}
          accessBadge="coach"
        />
      }
    >
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : !match ? (
        <EmptyState>試合が見つかりません</EmptyState>
      ) : categories.length === 0 ? (
        <EmptyState>
          スタッツ項目がまだありません。
          {canManageStatCategories(role) && (
            <>
              <br />
              <Link href="/game/stat-categories" className="text-orange font-bold">
                スタッツ項目を編集
              </Link>
              から追加してください。
            </>
          )}
        </EmptyState>
      ) : players.length === 0 ? (
        <EmptyState>選手が登録されていません</EmptyState>
      ) : (
        <div className="bg-white border border-line rounded-lg overflow-auto max-h-[75vh]">
          <table className="border-collapse text-[12px] w-full">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 h-9 bg-paper z-30 text-left px-2.5 border-b border-line whitespace-nowrap">
                  選手
                </th>
                {categories.map((c) => (
                  <th
                    key={c.id}
                    className="sticky top-0 h-9 bg-paper z-20 w-[64px] min-w-[64px] px-1 border-b border-line font-bold whitespace-nowrap text-center text-ink-soft"
                  >
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id}>
                  <td className="sticky left-0 bg-white z-10 px-2.5 py-1.5 whitespace-nowrap border-b border-line last:border-b-0 font-bold">
                    #{p.number ?? "-"} {playerFullName(p)}
                  </td>
                  {categories.map((c) => {
                    const key = `${p.id}:${c.id}`;
                    const entry = entries[key];
                    return (
                      <td key={c.id} className="px-1 py-1.5 text-center border-b border-line last:border-b-0">
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          inputMode="decimal"
                          defaultValue={entry?.value ?? ""}
                          onBlur={(e) => handleChange(p.id, c.id, e.target.value)}
                          disabled={savingKey === key}
                          className="w-[52px] text-center border border-line rounded-lg py-1 text-[12.5px] font-mono"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="text-xs text-ink-soft text-center mt-2.5">数値を入力すると自動で保存されます</div>
    </PageShell>
  );
}
