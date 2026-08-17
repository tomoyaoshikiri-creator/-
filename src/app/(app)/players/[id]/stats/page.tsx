"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { FieldLabel, inputClass } from "@/components/ui/SegButton";
import { canManagePlayers } from "@/lib/permissions";
import { hasKarteTabAccess } from "@/lib/plan";
import { StatCell } from "@/components/karte/StatCell";
import { computeSeasonAverages, GAME_COLUMNS } from "@/lib/karteAggregate";
import { effectiveFiscalYear, fiscalYearOf, formatDateLabel, playerFullName, todayDateStr } from "@/lib/format";
import type { GamePlayerStatLine, Player } from "@/lib/database.types";

const CURRENT_FISCAL_YEAR = fiscalYearOf(todayDateStr());
const FISCAL_YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_FISCAL_YEAR - 4 + i);

// FG/FTは「成功数/試投数」の分数表示になるため、他の列より少し幅を広げる。
const colWidthClass = (key: (typeof GAME_COLUMNS)[number]["key"]) =>
  key === "fgPct" || key === "ftPct" ? "w-[58px] min-w-[58px]" : "w-[50px] min-w-[50px]";

interface StatLineWithDate extends GamePlayerStatLine {
  game_matches: { opponent: string | null; schedules: { date: string; fiscal_year_override: number | null } | null } | null;
}

// 指導者・管理者専用の「カルテ」画面の試合スタッツ表と同じ内容を、選手一覧経由でも
// (自分の子どもに限り)保護者が閲覧できるようにするための、閲覧専用ページ。
export default function PlayerStatsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { role, userId, plan } = useSession();
  const isStaff = canManagePlayers(role);

  const [player, setPlayer] = useState<Player | null>(null);
  const [fiscalYear, setFiscalYear] = useState(CURRENT_FISCAL_YEAR);
  const [statLines, setStatLines] = useState<StatLineWithDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    if (!hasKarteTabAccess(plan)) {
      setAuthorized(false);
      router.replace("/players");
      return;
    }
    if (isStaff) {
      setAuthorized(true);
      return;
    }
    (async () => {
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
  }, [isStaff, userId, params.id, plan, router]);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: p }, { data: lines }] = await Promise.all([
      supabase.from("players").select("*").eq("id", params.id).single(),
      supabase
        .from("game_player_stat_lines")
        .select("*, game_matches(opponent, schedules(date, fiscal_year_override))")
        .eq("player_id", params.id)
        .returns<StatLineWithDate[]>(),
    ]);
    setPlayer(p ?? null);
    setStatLines(lines ?? []);
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const seasonLines = statLines
    .filter((l) => {
      const date = l.game_matches?.schedules?.date;
      if (!date) return false;
      return effectiveFiscalYear(date, l.game_matches?.schedules?.fiscal_year_override ?? null) === fiscalYear;
    })
    .sort((a, b) => (a.game_matches?.schedules?.date ?? "").localeCompare(b.game_matches?.schedules?.date ?? ""));
  const seasonAverages = computeSeasonAverages(seasonLines);
  const gameRows = seasonLines.map((l) => ({
    label: `${formatDateLabel(l.game_matches?.schedules?.date ?? "")} vs ${l.game_matches?.opponent ?? "-"}`,
    averages: computeSeasonAverages([l]),
  }));

  return (
    <PageShell
      header={
        <AppHeader
          title={player ? `${playerFullName(player)} / スタッツ` : "スタッツ"}
          variant="detail"
          backHref={`/players/${params.id}`}
        />
      }
    >
      {loading || !authorized ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : !player ? (
        <EmptyState>選手が見つかりません</EmptyState>
      ) : (
        <>
          <SectionLabel>年度</SectionLabel>
          <Card>
            <FieldLabel>年度</FieldLabel>
            <select className={inputClass()} value={fiscalYear} onChange={(e) => setFiscalYear(Number(e.target.value))}>
              {FISCAL_YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}年度
                </option>
              ))}
            </select>
          </Card>

          <SectionLabel>試合ごとのスタッツ</SectionLabel>
          {gameRows.length === 0 ? (
            <Card>
              <EmptyState>この年度の出場記録がありません</EmptyState>
            </Card>
          ) : (
            <div className="bg-white border border-line rounded-2xl overflow-auto max-h-[65vh] mb-2.5">
              <table className="border-collapse text-[11.5px] w-full">
                <thead>
                  <tr>
                    <th className="sticky left-0 top-0 h-9 bg-paper z-30 text-left px-2.5 border-b border-line whitespace-nowrap">
                      試合
                    </th>
                    {GAME_COLUMNS.map((c) => (
                      <th
                        key={c.key}
                        className={`sticky top-0 h-9 bg-paper z-20 ${colWidthClass(c.key)} px-1 border-b border-line font-bold whitespace-nowrap text-center text-ink-soft`}
                      >
                        {c.abbr}
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-paper">
                    <th className="sticky left-0 top-9 h-9 bg-paper z-30 text-left px-2.5 border-b border-line whitespace-nowrap font-bold">
                      シーズン平均
                    </th>
                    {GAME_COLUMNS.map((c) => {
                      const v = seasonAverages[c.key] as number | null;
                      return (
                        <th
                          key={c.key}
                          className={`sticky top-9 h-9 bg-paper z-20 ${colWidthClass(c.key)} px-1 text-center font-mono font-bold border-b border-line whitespace-nowrap ${
                            c.key === "eff" && v !== null && v < 0 ? "text-danger" : ""
                          }`}
                        >
                          <StatCell statKey={c.key} averages={seasonAverages} />
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {gameRows.map((row, i) => (
                    <tr key={i}>
                      <td className="sticky left-0 bg-white z-10 px-2.5 py-2 whitespace-nowrap border-b border-line last:border-b-0">
                        {row.label}
                      </td>
                      {GAME_COLUMNS.map((c) => {
                        const v = row.averages[c.key] as number | null;
                        return (
                          <td
                            key={c.key}
                            className={`${colWidthClass(c.key)} px-1 py-2 text-center font-mono border-b border-line last:border-b-0 whitespace-nowrap ${
                              c.key === "eff" && v !== null && v < 0 ? "text-danger" : ""
                            }`}
                          >
                            <StatCell statKey={c.key} averages={row.averages} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <ul className="text-[10.5px] text-ink-soft leading-relaxed mb-2.5 pl-4 list-disc space-y-0.5">
            <li>PTS:得点</li>
            <li>FG%:フィールドゴール成功率(下段は成功数/試投数)</li>
            <li>FT%:フリースロー成功率(下段は成功数/試投数)</li>
            <li>AST:アシスト</li>
            <li>OREB:オフェンスリバウンド</li>
            <li>DREB:ディフェンスリバウンド</li>
            <li>STL:スティール</li>
            <li>BLK:ブロック</li>
            <li>TO:ターンオーバー</li>
            <li>EFF:得点+リバウンド+アシスト+スティール+ブロック−(FG失敗+FT失敗+ターンオーバー)</li>
          </ul>
        </>
      )}
    </PageShell>
  );
}
