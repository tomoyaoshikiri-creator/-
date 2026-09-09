"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { canRecordGames } from "@/lib/permissions";
import { usesDetailedBasketballStats, usesThreePointScoring } from "@/lib/sport";
import { fgPct, threePct, ftPct, type StatTotals } from "@/lib/gameStats";
import { playerFullName, sortPlayers, sortOpponentPlayers } from "@/lib/format";
import type {
  GameMatch,
  GameOpponentPlayer,
  GameOpponentStatLine,
  GamePlayerStatLine,
  Player,
  Schedule,
} from "@/lib/database.types";

interface BoxScoreRow {
  id: string;
  label: string;
  line: StatTotals;
}

function sumLines(rows: BoxScoreRow[]): StatTotals {
  return rows.reduce<StatTotals>(
    (sum, r) => ({
      fg_made: sum.fg_made + r.line.fg_made,
      fg_att: sum.fg_att + r.line.fg_att,
      three_made: sum.three_made + r.line.three_made,
      three_att: sum.three_att + r.line.three_att,
      ft_made: sum.ft_made + r.line.ft_made,
      ft_att: sum.ft_att + r.line.ft_att,
      pts: sum.pts + r.line.pts,
      reb_off: sum.reb_off + r.line.reb_off,
      reb_def: sum.reb_def + r.line.reb_def,
      ast: sum.ast + r.line.ast,
      blk: sum.blk + r.line.blk,
      stl: sum.stl + r.line.stl,
      tov: sum.tov + r.line.tov,
      fouls: sum.fouls + r.line.fouls,
      reb: sum.reb + r.line.reb,
      eff: sum.eff + r.line.eff,
    }),
    {
      fg_made: 0,
      fg_att: 0,
      three_made: 0,
      three_att: 0,
      ft_made: 0,
      ft_att: 0,
      pts: 0,
      reb_off: 0,
      reb_def: 0,
      ast: 0,
      blk: 0,
      stl: 0,
      tov: 0,
      fouls: 0,
      reb: 0,
      eff: 0,
    },
  );
}

function BoxScoreTable({ title, rows, showThreePoint }: { title: string; rows: BoxScoreRow[]; showThreePoint: boolean }) {
  const total = sumLines(rows);
  const count = rows.length;
  // 選手ごとの平均(小数第1位)。EFFは合計を出す意味が薄いため、合計行では表示せず平均のみ出す。
  const avg = (n: number) => (count > 0 ? (n / count).toFixed(1) : "0.0");
  return (
    <div className="mt-4">
      <SectionLabel>{title}</SectionLabel>
      {rows.length === 0 ? (
        <EmptyState>スタッツの記録がありません</EmptyState>
      ) : (
        <div className="bg-white border border-line rounded-lg overflow-auto max-h-[60vh]">
          <table className="border-collapse text-[12px] w-full">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 h-9 bg-paper z-30 text-left px-2.5 border-b border-line whitespace-nowrap">
                  選手
                </th>
                {[
                  "PTS",
                  "FG",
                  ...(showThreePoint ? ["3P"] : []),
                  "FT",
                  "REB",
                  "AST",
                  "STL",
                  "BLK",
                  "TOV",
                  "PF",
                  "EFF",
                ].map((h) => (
                  <th
                    key={h}
                    className="sticky top-0 h-9 bg-paper z-20 px-2 border-b border-line font-bold whitespace-nowrap text-center text-ink-soft"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="sticky left-0 bg-white z-10 px-2.5 py-1.5 whitespace-nowrap border-b border-line last:border-b-0 font-bold">
                    {r.label}
                  </td>
                  <td className="px-2 py-1.5 text-center border-b border-line last:border-b-0 font-mono font-bold text-orange">
                    {r.line.pts}
                  </td>
                  <td className="px-2 py-1.5 text-center border-b border-line last:border-b-0 font-mono whitespace-nowrap">
                    {r.line.fg_made}/{r.line.fg_att}
                    <span className="text-ink-soft"> ({fgPct(r.line)})</span>
                  </td>
                  {showThreePoint && (
                    <td className="px-2 py-1.5 text-center border-b border-line last:border-b-0 font-mono whitespace-nowrap">
                      {r.line.three_made}/{r.line.three_att}
                      <span className="text-ink-soft"> ({threePct(r.line)})</span>
                    </td>
                  )}
                  <td className="px-2 py-1.5 text-center border-b border-line last:border-b-0 font-mono whitespace-nowrap">
                    {r.line.ft_made}/{r.line.ft_att}
                    <span className="text-ink-soft"> ({ftPct(r.line)})</span>
                  </td>
                  <td className="px-2 py-1.5 text-center border-b border-line last:border-b-0 font-mono">{r.line.reb}</td>
                  <td className="px-2 py-1.5 text-center border-b border-line last:border-b-0 font-mono">{r.line.ast}</td>
                  <td className="px-2 py-1.5 text-center border-b border-line last:border-b-0 font-mono">{r.line.stl}</td>
                  <td className="px-2 py-1.5 text-center border-b border-line last:border-b-0 font-mono">{r.line.blk}</td>
                  <td className="px-2 py-1.5 text-center border-b border-line last:border-b-0 font-mono">{r.line.tov}</td>
                  <td className="px-2 py-1.5 text-center border-b border-line last:border-b-0 font-mono">{r.line.fouls}</td>
                  <td className="px-2 py-1.5 text-center border-b border-line last:border-b-0 font-mono">{r.line.eff}</td>
                </tr>
              ))}
              <tr>
                <td className="sticky left-0 bg-paper z-10 px-2.5 py-1.5 whitespace-nowrap font-bold">合計</td>
                <td className="px-2 py-1.5 text-center bg-paper font-mono font-bold text-orange">{total.pts}</td>
                <td className="px-2 py-1.5 text-center bg-paper font-mono whitespace-nowrap">
                  {total.fg_made}/{total.fg_att}
                  <span className="text-ink-soft"> ({fgPct(total)})</span>
                </td>
                {showThreePoint && (
                  <td className="px-2 py-1.5 text-center bg-paper font-mono whitespace-nowrap">
                    {total.three_made}/{total.three_att}
                    <span className="text-ink-soft"> ({threePct(total)})</span>
                  </td>
                )}
                <td className="px-2 py-1.5 text-center bg-paper font-mono whitespace-nowrap">
                  {total.ft_made}/{total.ft_att}
                  <span className="text-ink-soft"> ({ftPct(total)})</span>
                </td>
                <td className="px-2 py-1.5 text-center bg-paper font-mono">{total.reb}</td>
                <td className="px-2 py-1.5 text-center bg-paper font-mono">{total.ast}</td>
                <td className="px-2 py-1.5 text-center bg-paper font-mono">{total.stl}</td>
                <td className="px-2 py-1.5 text-center bg-paper font-mono">{total.blk}</td>
                <td className="px-2 py-1.5 text-center bg-paper font-mono">{total.tov}</td>
                <td className="px-2 py-1.5 text-center bg-paper font-mono">{total.fouls}</td>
                <td className="px-2 py-1.5 text-center bg-paper font-mono text-ink-soft">-</td>
              </tr>
              <tr>
                <td className="sticky left-0 bg-paper z-10 px-2.5 py-1.5 whitespace-nowrap font-bold">平均</td>
                <td className="px-2 py-1.5 text-center bg-paper font-mono font-bold text-orange">{avg(total.pts)}</td>
                <td className="px-2 py-1.5 text-center bg-paper font-mono whitespace-nowrap">
                  {avg(total.fg_made)}/{avg(total.fg_att)}
                </td>
                {showThreePoint && (
                  <td className="px-2 py-1.5 text-center bg-paper font-mono whitespace-nowrap">
                    {avg(total.three_made)}/{avg(total.three_att)}
                  </td>
                )}
                <td className="px-2 py-1.5 text-center bg-paper font-mono whitespace-nowrap">
                  {avg(total.ft_made)}/{avg(total.ft_att)}
                </td>
                <td className="px-2 py-1.5 text-center bg-paper font-mono">{avg(total.reb)}</td>
                <td className="px-2 py-1.5 text-center bg-paper font-mono">{avg(total.ast)}</td>
                <td className="px-2 py-1.5 text-center bg-paper font-mono">{avg(total.stl)}</td>
                <td className="px-2 py-1.5 text-center bg-paper font-mono">{avg(total.blk)}</td>
                <td className="px-2 py-1.5 text-center bg-paper font-mono">{avg(total.tov)}</td>
                <td className="px-2 py-1.5 text-center bg-paper font-mono">{avg(total.fouls)}</td>
                <td className="px-2 py-1.5 text-center bg-paper font-mono">{avg(total.eff)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function GameStatsViewPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = params.matchId;
  const router = useRouter();
  const { role, sport } = useSession();

  useEffect(() => {
    if (!usesDetailedBasketballStats(sport) || !canRecordGames(role)) router.replace("/game");
  }, [sport, role, router]);

  const [match, setMatch] = useState<GameMatch | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [ownRows, setOwnRows] = useState<BoxScoreRow[]>([]);
  const [opponentRows, setOpponentRows] = useState<BoxScoreRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: m } = await supabase.from("game_matches").select("*").eq("id", matchId).single();
    setMatch(m ?? null);
    if (m) {
      const [{ data: s }, { data: players }, { data: opponentPlayers }, { data: lines }, { data: opponentLines }] =
        await Promise.all([
          supabase.from("schedules").select("*").eq("id", m.schedule_id).single(),
          supabase.from("players").select("*"),
          supabase.from("game_opponent_players").select("*").eq("match_id", matchId),
          supabase.from("game_player_stat_lines").select("*").eq("match_id", matchId),
          supabase.from("game_opponent_stat_lines").select("*").eq("match_id", matchId),
        ]);
      setSchedule(s ?? null);

      // スタッツ記録がある選手だけを、名簿順(自チーム)・背番号順(相手チーム)で並べる。
      const lineByPlayerId = new Map((lines ?? []).map((l: GamePlayerStatLine) => [l.player_id, l]));
      setOwnRows(
        sortPlayers(players ?? [])
          .filter((p: Player) => lineByPlayerId.has(p.id))
          .map((p: Player) => {
            const l = lineByPlayerId.get(p.id)!;
            return { id: l.id, label: `#${p.number ?? "-"} ${playerFullName(p)}`, line: l };
          }),
      );

      const opponentLineByPlayerId = new Map(
        (opponentLines ?? []).map((l: GameOpponentStatLine) => [l.opponent_player_id, l]),
      );
      setOpponentRows(
        sortOpponentPlayers(opponentPlayers ?? [])
          .filter((p: GameOpponentPlayer) => opponentLineByPlayerId.has(p.id))
          .map((p: GameOpponentPlayer) => {
            const l = opponentLineByPlayerId.get(p.id)!;
            return { id: l.id, label: `#${p.number}`, line: l };
          }),
      );
    }
    setLoading(false);
  }, [matchId]);

  useEffect(() => {
    load();
  }, [load]);

  const showThreePoint = usesThreePointScoring(sport);
  const teamScore = ownRows.reduce((sum, r) => sum + r.line.pts, 0);
  const opponentScore = opponentRows.reduce((sum, r) => sum + r.line.pts, 0);

  return (
    <PageShell
      header={
        <AppHeader
          title="スタッツを見る"
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
      ) : (
        <>
          <Card>
            <div className="font-bold text-[13.5px] text-center">
              第{match.game_number}試合{match.opponent ? ` vs ${match.opponent}` : ""}
            </div>
            <div className="flex items-center justify-center gap-6 mt-1.5">
              <div className="text-center">
                <div className="text-[11px] font-bold text-ink-soft">{schedule?.title ?? "自チーム"}</div>
                <div className="font-mono text-[28px] font-bold text-orange leading-tight">{teamScore}</div>
              </div>
              <div className="text-ink-soft font-bold text-[16px]">-</div>
              <div className="text-center">
                <div className="text-[11px] font-bold text-ink-soft">{match.opponent || "相手"}</div>
                <div className="font-mono text-[28px] font-bold leading-tight">{opponentScore}</div>
              </div>
            </div>
            <div className="text-[10px] text-ink-soft text-center mt-1">スタッツの記録から集計した得点です</div>
          </Card>

          <BoxScoreTable title="自チームのスタッツ" rows={ownRows} showThreePoint={showThreePoint} />
          <BoxScoreTable title="相手チームのスタッツ" rows={opponentRows} showThreePoint={showThreePoint} />
        </>
      )}
    </PageShell>
  );
}
