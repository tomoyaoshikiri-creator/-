"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { NumChip } from "@/components/ui/Pill";
import { FieldLabel, SegButton } from "@/components/ui/SegButton";
import { ChevronRightIcon } from "@/components/icons";
import { canViewKarte } from "@/lib/permissions";
import { computeSeasonAverages } from "@/lib/karteAggregate";
import { effectiveFiscalYear, fiscalYearOf, formatDateLabel, gradeLabel, playerFullName, todayDateStr } from "@/lib/format";
import type { GamePlayerStatLine, Player, PlayerGrowthRecord, SportsTestRecord } from "@/lib/database.types";

const CURRENT_FISCAL_YEAR = fiscalYearOf(todayDateStr());
const FISCAL_YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_FISCAL_YEAR - 4 + i);
const QUARTERS = [1, 2, 3, 4] as const;

interface StatLineWithDate extends GamePlayerStatLine {
  game_matches: { schedules: { date: string; fiscal_year_override: number | null } | null } | null;
}

const SPORTS_TEST_FIELDS: { key: keyof SportsTestRecord; label: string; unit: string }[] = [
  { key: "wingspan_cm", label: "ウイングスパン", unit: "cm" },
  { key: "sprint20m_1", label: "20mスプリント①", unit: "秒" },
  { key: "sprint20m_2", label: "20mスプリント②", unit: "秒" },
  { key: "long_jump_1", label: "立ち幅跳び①", unit: "cm" },
  { key: "long_jump_2", label: "立ち幅跳び②", unit: "cm" },
  { key: "lane_agility_1", label: "レーンアジリティ①", unit: "秒" },
  { key: "lane_agility_2", label: "レーンアジリティ②", unit: "秒" },
  { key: "side_step_1", label: "反復横跳び①", unit: "点" },
  { key: "side_step_2", label: "反復横跳び②", unit: "点" },
  { key: "shuttle_20m_x3", label: "20m三往復", unit: "秒" },
  { key: "ball_throw_1", label: "ボール投げ①", unit: "m" },
  { key: "ball_throw_2", label: "ボール投げ②", unit: "m" },
  { key: "back_fist_right", label: "背中こぶし合わせ(右上)", unit: "cm" },
  { key: "back_fist_left", label: "背中こぶし合わせ(左上)", unit: "cm" },
  { key: "ft_golf", label: "FTゴルフ", unit: "/10" },
  { key: "beep_test_reps", label: "20mシャトルラン", unit: "回" },
];

export default function KartePlayerPage() {
  const params = useParams<{ playerId: string }>();
  const router = useRouter();
  const { role } = useSession();

  const [player, setPlayer] = useState<Player | null>(null);
  const [fiscalYear, setFiscalYear] = useState(CURRENT_FISCAL_YEAR);
  const [quarter, setQuarter] = useState<number>(1);
  const [statLines, setStatLines] = useState<StatLineWithDate[]>([]);
  const [sportsTestRecord, setSportsTestRecord] = useState<SportsTestRecord | null>(null);
  const [growthRecords, setGrowthRecords] = useState<PlayerGrowthRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canViewKarte(role)) router.replace("/schedule");
  }, [role, router]);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: p }, { data: lines }, { data: test }, { data: growth }] = await Promise.all([
      supabase.from("players").select("*").eq("id", params.playerId).single(),
      supabase
        .from("game_player_stat_lines")
        .select("*, game_matches(schedules(date, fiscal_year_override))")
        .eq("player_id", params.playerId)
        .returns<StatLineWithDate[]>(),
      supabase
        .from("sports_test_records")
        .select("*")
        .eq("player_id", params.playerId)
        .eq("fiscal_year", fiscalYear)
        .eq("quarter", quarter)
        .maybeSingle(),
      supabase
        .from("player_growth_records")
        .select("*")
        .eq("player_id", params.playerId)
        .order("measured_on", { ascending: false })
        .limit(6),
    ]);
    setPlayer(p ?? null);
    setStatLines(lines ?? []);
    setSportsTestRecord(test ?? null);
    setGrowthRecords(growth ?? []);
    setLoading(false);
  }, [params.playerId, fiscalYear, quarter]);

  useEffect(() => {
    load();
  }, [load]);

  const seasonLines = statLines.filter((l) => {
    const date = l.game_matches?.schedules?.date;
    if (!date) return false;
    return effectiveFiscalYear(date, l.game_matches?.schedules?.fiscal_year_override ?? null) === fiscalYear;
  });
  const averages = computeSeasonAverages(seasonLines);

  if (loading) {
    return (
      <PageShell header={<AppHeader title="カルテ" variant="detail" backHref="/karte/players" />}>
        <EmptyState>読み込み中…</EmptyState>
      </PageShell>
    );
  }

  if (!player) {
    return (
      <PageShell header={<AppHeader title="カルテ" variant="detail" backHref="/karte/players" />}>
        <EmptyState>選手が見つかりません</EmptyState>
      </PageShell>
    );
  }

  return (
    <PageShell header={<AppHeader title={`${playerFullName(player)} / カルテ`} variant="detail" backHref="/karte/players" />}>
      <Card>
        <div className="flex items-center gap-2.5">
          <NumChip num={player.number ?? "-"} />
          <div>
            <div className="font-bold text-[13.5px]">{playerFullName(player)}</div>
            <div className="text-[11px] text-ink-soft mt-0.5">
              {gradeLabel(player.grade)}・{player.positions.join("/")}
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-3">
        <FieldLabel>年度</FieldLabel>
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
      </div>

      <SectionLabel>試合スタッツ(シーズン平均)</SectionLabel>
      <Card>
        {averages.gp === 0 ? (
          <EmptyState>この年度の出場記録がありません</EmptyState>
        ) : (
          <>
            <div className="text-[12px] font-bold text-ink-soft mb-2">GP {averages.gp}試合</div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "PTS", value: averages.pts },
                { label: "REB", value: averages.reb },
                { label: "AST", value: averages.ast },
                { label: "STL", value: averages.stl },
                { label: "BLK", value: averages.blk },
                { label: "TOV", value: averages.tov },
                { label: "FOUL", value: averages.fouls },
                { label: "EFF", value: averages.eff },
                { label: "FG%", value: averages.fgPct ?? "-" },
                { label: "FT%", value: averages.ftPct ?? "-" },
              ].map((item) => (
                <div key={item.label} className="text-center bg-paper rounded-[10px] py-2">
                  <div className="text-[10px] font-bold text-ink-soft">{item.label}</div>
                  <div
                    className={`font-mono text-[15px] font-bold mt-0.5 ${
                      item.label === "EFF" && typeof item.value === "number" && item.value < 0 ? "text-danger" : ""
                    }`}
                  >
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <SectionLabel>スポーツテスト</SectionLabel>
      <div className="flex gap-1.5 mb-2">
        {QUARTERS.map((q) => (
          <SegButton key={q} active={quarter === q} onClick={() => setQuarter(q)}>
            Q{q}
          </SegButton>
        ))}
      </div>
      <Card>
        {!sportsTestRecord || sportsTestRecord.not_conducted ? (
          <EmptyState>{sportsTestRecord?.not_conducted ? "未実施" : "この四半期の記録がありません"}</EmptyState>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            {SPORTS_TEST_FIELDS.map((f) => {
              const v = sportsTestRecord[f.key];
              return (
                <div key={f.key} className="flex items-baseline justify-between">
                  <span className="text-[11px] text-ink-soft">{f.label}</span>
                  <span className="font-mono text-[13px] font-bold ml-1">
                    {v === null || v === undefined ? "-" : `${v}${f.unit}`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <Link
          href={`/players/${player.id}/sports-test`}
          className="block mt-3 text-center py-2 rounded-[10px] font-bold text-[12px] border border-line text-ink-soft bg-paper"
        >
          記録を入力・編集する
        </Link>
      </Card>

      <SectionLabel>身長・体重(週次)</SectionLabel>
      <Card>
        {growthRecords.length === 0 ? (
          <EmptyState>記録がありません</EmptyState>
        ) : (
          <div className="text-[13px]">
            {growthRecords.map((g) => (
              <div key={g.id} className="flex items-center justify-between py-1 border-b border-line last:border-b-0">
                <span className="text-ink-soft text-[11px]">{formatDateLabel(g.measured_on)}</span>
                <span className="font-mono font-bold">
                  {g.height_cm ?? "-"}cm / {g.weight_kg ?? "-"}kg
                </span>
              </div>
            ))}
          </div>
        )}
        <Link
          href={`/players/${player.id}/growth`}
          className="block mt-3 text-center py-2 rounded-[10px] font-bold text-[12px] border border-line text-ink-soft bg-paper"
        >
          記録を入力・編集する
        </Link>
      </Card>
    </PageShell>
  );
}
