"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState } from "@/components/ui/Card";
import { SegButton, FieldLabel } from "@/components/ui/SegButton";
import { ChevronRightIcon } from "@/components/icons";
import { canViewKarte } from "@/lib/permissions";
import { hasSportsTestAccess } from "@/lib/plan";
import { SPORTS_TEST_RANKING_METRICS, type SportsTestMetric } from "@/lib/karteAggregate";
import { fiscalYearOf, playerFullName, sortPlayers, todayDateStr } from "@/lib/format";
import type { Database, Player, SportsTestRecord } from "@/lib/database.types";

const CURRENT_FISCAL_YEAR = fiscalYearOf(todayDateStr());
const FISCAL_YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_FISCAL_YEAR - 4 + i);
const QUARTERS = [1, 2, 3, 4] as const;

type SportsTestValues = Partial<Record<SportsTestMetric, number | null>>;
type TeamAverageRow = Database["public"]["Functions"]["team_sports_test_averages"]["Returns"][number];

function SportsTestLegend() {
  return (
    <ul className="text-[10.5px] text-ink-soft leading-relaxed mb-2.5 pl-4 list-disc space-y-0.5">
      {SPORTS_TEST_RANKING_METRICS.map((m) => (
        <li key={m.value}>
          {m.abbrLines.join("")}:{m.label}
          {m.unit ? `(${m.unit})` : ""}
        </li>
      ))}
    </ul>
  );
}

export default function KarteTeamSportsTestPage() {
  const router = useRouter();
  const { role, plan } = useSession();
  const isStaff = canViewKarte(role);

  useEffect(() => {
    if (!hasSportsTestAccess(plan)) router.replace("/karte");
  }, [plan, router]);

  const [players, setPlayers] = useState<Player[]>([]);
  const [sportsTestRecords, setSportsTestRecords] = useState<SportsTestRecord[]>([]);
  const [teamAverageRow, setTeamAverageRow] = useState<TeamAverageRow | null>(null);
  const [fiscalYear, setFiscalYear] = useState(CURRENT_FISCAL_YEAR);
  const [quarter, setQuarter] = useState<number>(1);
  const [rankingMode, setRankingMode] = useState(false);
  const [sortKey, setSortKey] = useState<SportsTestMetric>("sprint20m");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isStaff || !hasSportsTestAccess(plan)) return;
    (async () => {
      const supabase = createClient();
      const { data: p } = await supabase.from("players").select("*");
      setPlayers(sortPlayers(p ?? []));
    })();
  }, [isStaff, plan]);

  useEffect(() => {
    if (!isStaff || !hasSportsTestAccess(plan)) return;
    (async () => {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("sports_test_records")
        .select("*")
        .eq("fiscal_year", fiscalYear)
        .eq("quarter", quarter)
        .eq("not_conducted", false);
      setSportsTestRecords(data ?? []);
      setLoading(false);
    })();
  }, [isStaff, fiscalYear, quarter, plan]);

  useEffect(() => {
    if (isStaff || !hasSportsTestAccess(plan)) return;
    setLoading(true);
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc("team_sports_test_averages", {
        p_fiscal_year: fiscalYear,
        p_quarter: quarter,
      });
      setTeamAverageRow(data?.[0] ?? null);
      setLoading(false);
    })();
  }, [isStaff, fiscalYear, quarter, plan]);

  // 在籍中の選手は常に表示。OB・OGは選んだ年度・四半期に記録がある場合だけ一覧に含める。
  const sportsTestPlayers = players.filter(
    (p) => p.status !== "OB・OG" || sportsTestRecords.some((r) => r.player_id === p.id),
  );
  const sportsTestValues: { player: Player; values: SportsTestValues }[] = sportsTestPlayers.map((p) => {
    const record = sportsTestRecords.find((r) => r.player_id === p.id);
    const values: SportsTestValues = {};
    SPORTS_TEST_RANKING_METRICS.forEach((m) => {
      values[m.value] = record ? m.extract(record) : null;
    });
    return { player: p, values };
  });
  const teamAverages: SportsTestValues = {};
  SPORTS_TEST_RANKING_METRICS.forEach((m) => {
    const nums = sportsTestValues
      .map((v) => v.values[m.value])
      .filter((v): v is number => v !== null && v !== undefined);
    teamAverages[m.value] =
      nums.length > 0 ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null;
  });
  const sortInfo = SPORTS_TEST_RANKING_METRICS.find((m) => m.value === sortKey)!;
  const sortValue = (v: SportsTestValues) => {
    const val = v[sortKey];
    if (val === null || val === undefined) return sortInfo.direction === "asc" ? Infinity : -Infinity;
    return val;
  };
  const rows = rankingMode
    ? [...sportsTestValues].sort((a, b) =>
        sortInfo.direction === "asc"
          ? sortValue(a.values) - sortValue(b.values)
          : sortValue(b.values) - sortValue(a.values),
      )
    : sportsTestValues;

  return (
    <PageShell
      header={
        <AppHeader
          title="スポーツテスト"
          variant="detail"
          backHref="/karte/team"
          accessBadge={isStaff ? "coach" : undefined}
        />
      }
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="relative inline-block">
          <select
            className="appearance-none bg-white border border-line rounded-[10px] pl-3 pr-8 py-1.5 text-[12.5px] font-bold text-ink"
            value={fiscalYear}
            onChange={(e) => setFiscalYear(Number(e.target.value))}
          >
            {FISCAL_YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}年度
              </option>
            ))}
          </select>
          <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
        </div>
        {isStaff && (
          <button
            type="button"
            onClick={() => setRankingMode((v) => !v)}
            className={`flex-none text-center px-5 py-2 rounded-[10px] font-bold text-[13px] border ${
              rankingMode ? "border-orange bg-orange text-white" : "border-line text-ink-soft bg-white"
            }`}
          >
            {rankingMode ? "ランキング中" : "ランキングで見る"}
          </button>
        )}
      </div>

      <FieldLabel>四半期</FieldLabel>
      <div className="flex gap-1.5 mb-3">
        {QUARTERS.map((q) => (
          <SegButton key={q} active={quarter === q} onClick={() => setQuarter(q)}>
            Q{q}
          </SegButton>
        ))}
      </div>

      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : !isStaff ? (
        <>
          <Card>
            <div className="text-[11.5px] font-bold text-ink-soft mb-3">チーム平均</div>
            {!teamAverageRow || teamAverageRow.record_count === 0 ? (
              <div className="text-xs text-ink-soft">この四半期の記録はありません</div>
            ) : (
              <div className="grid grid-cols-3 gap-y-3 text-center">
                {SPORTS_TEST_RANKING_METRICS.map((m) => {
                  const v = teamAverageRow[m.value];
                  return (
                    <div key={m.value}>
                      <div className="text-[10px] text-ink-soft font-bold leading-tight">
                        <div>{m.abbrLines[0]}</div>
                        <div>{m.abbrLines[1]}</div>
                      </div>
                      <div className="font-mono font-bold text-[13px] mt-0.5">{v === null || v === undefined ? "-" : v}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
          <SportsTestLegend />
        </>
      ) : (
        <>
          {rankingMode && (
            <div className="text-[11px] text-ink-soft mb-1.5">項目名をタップすると、その項目順に並び替わります</div>
          )}

          <div className="bg-white border border-line rounded-2xl overflow-auto max-h-[65vh] mb-2.5">
            <table className="border-collapse text-[11.5px] w-full">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 h-11 bg-paper z-30 text-left px-2.5 border-b border-line whitespace-nowrap">
                    選手
                  </th>
                  {SPORTS_TEST_RANKING_METRICS.map((m) => (
                    <th
                      key={m.value}
                      onClick={() => rankingMode && setSortKey(m.value)}
                      className={`sticky top-0 h-11 bg-paper z-20 w-[54px] min-w-[54px] px-1 border-b border-line font-bold text-center leading-tight ${
                        rankingMode ? "cursor-pointer" : ""
                      } ${rankingMode && sortKey === m.value ? "text-orange" : "text-ink-soft"}`}
                    >
                      <div className="whitespace-nowrap">{m.abbrLines[0]}</div>
                      <div className="whitespace-nowrap">{m.abbrLines[1]}</div>
                    </th>
                  ))}
                </tr>
                <tr className="bg-paper">
                  <th className="sticky left-0 top-11 h-9 bg-paper z-30 text-left px-2.5 border-b border-line whitespace-nowrap font-bold">
                    チーム平均
                  </th>
                  {SPORTS_TEST_RANKING_METRICS.map((m) => {
                    const v = teamAverages[m.value];
                    return (
                      <th
                        key={m.value}
                        className="sticky top-11 h-9 bg-paper z-20 w-[54px] min-w-[54px] px-1 text-center font-mono font-bold border-b border-line"
                      >
                        {v === null || v === undefined ? "-" : v}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ player: p, values }) => (
                  <tr key={p.id}>
                    <td className="sticky left-0 bg-white z-10 px-2.5 py-2 whitespace-nowrap border-b border-line last:border-b-0">
                      <Link href={`/karte/players/${p.id}`} className="font-bold">
                        #{p.number ?? "-"} {playerFullName(p)}
                      </Link>
                    </td>
                    {SPORTS_TEST_RANKING_METRICS.map((m) => {
                      const v = values[m.value];
                      return (
                        <td
                          key={m.value}
                          className="w-[54px] min-w-[54px] px-1 py-2 text-center font-mono border-b border-line last:border-b-0"
                        >
                          {v === null || v === undefined ? "-" : v}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SportsTestLegend />
        </>
      )}
    </PageShell>
  );
}
