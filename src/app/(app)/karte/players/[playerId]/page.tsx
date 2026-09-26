"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { NumChip } from "@/components/ui/Pill";
import { FieldLabel, SegButton, SubmitButton, TextTab, inputClass } from "@/components/ui/SegButton";
import { Switch } from "@/components/ui/Switch";
import { InlineSelect } from "@/components/ui/InlineSelect";
import { ChevronRightIcon } from "@/components/icons";
import { LineTrendChart } from "@/components/charts/LineTrendChart";
import { canManagePlayers, canViewKarte } from "@/lib/permissions";
import { hasAiAnalysisAccess, hasKarteTabAccess, hasSkillTestAccess, hasSportsTestAccess } from "@/lib/plan";
import { usesDetailedBasketballStats, usesThreePointScoring } from "@/lib/sport";
import { GRADES_BY_CATEGORY, POSITIONS_BY_SPORT, STATUS_OPTIONS } from "@/lib/playerOptions";
import { GRADUATION_GRADE_BY_CATEGORY } from "@/lib/category";
import { useUnsavedChangesGuard } from "@/lib/navigationGuard";
import { StatCell } from "@/components/karte/StatCell";
import { SkillTestPanel } from "@/components/karte/SkillTestPanel";
import { BirthdaySelect } from "../../../players/BirthdaySelect";
import {
  computeCustomSeasonAverages,
  computeSeasonAverages,
  computeSeasonTotals,
  compareGameDesc,
  pctString,
  toSeasonStatAverages,
  GAME_COLUMNS,
  buildGameColumns,
  SPORTS_TEST_RANKING_METRICS,
  type SportsTestMetric,
  type TeamGameStatAveragesRow,
} from "@/lib/karteAggregate";
import {
  effectiveFiscalYear,
  fiscalYearOf,
  formatDateLabel,
  formatFullDateLabel,
  gradeLabel,
  obogCohortLabel,
  playerFullName,
  sortPlayers,
  todayDateStr,
} from "@/lib/format";
import type {
  Database,
  GamePlayerStatEntry,
  GamePlayerStatLine,
  Grade,
  Player,
  PlayerGrowthRecord,
  PlayerSkillTestProgress,
  PlayerStatus,
  Position,
  SkillTest,
  SportsTestRecord,
  TeamStatCategory,
} from "@/lib/database.types";

type TeamCustomAverageRow = Database["public"]["Functions"]["team_stat_category_averages"]["Returns"][number];

const CURRENT_FISCAL_YEAR = fiscalYearOf(todayDateStr());
const FISCAL_YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_FISCAL_YEAR - 4 + i);
const QUARTERS = [1, 2, 3, 4] as const;

// FG/FTは「成功数/試投数」の分数表示になるため、他の列より少し幅を広げる。
const colWidthClass = (key: (typeof GAME_COLUMNS)[number]["key"]) =>
  key === "fgPct" || key === "ftPct" || key === "twoPct" || key === "threePct"
    ? "w-[58px] min-w-[58px]"
    : "w-[50px] min-w-[50px]";

interface StatLineWithDate extends GamePlayerStatLine {
  game_matches: {
    opponent: string | null;
    game_number: number;
    schedules: { date: string; fiscal_year_override: number | null } | null;
  } | null;
}

interface StatEntryWithDate extends GamePlayerStatEntry {
  game_matches: {
    opponent: string | null;
    game_number: number;
    schedules: { date: string; fiscal_year_override: number | null } | null;
  } | null;
}

export default function KartePlayerPage() {
  const params = useParams<{ playerId: string }>();
  const router = useRouter();
  const { role, userId, plan, sport, category } = useSession();
  const isStaff = canViewKarte(role);
  const columns = buildGameColumns(usesThreePointScoring(sport));
  const toast = useToast();
  const positionOptions = POSITIONS_BY_SPORT[sport];
  const gradeOptions = GRADES_BY_CATEGORY[category];

  const [player, setPlayer] = useState<Player | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sei, setSei] = useState("");
  const [mei, setMei] = useState("");
  const [seiKana, setSeiKana] = useState("");
  const [meiKana, setMeiKana] = useState("");
  const [grade, setGrade] = useState("");
  const [number, setNumber] = useState("");
  const [positions, setPositions] = useState<Position[]>([]);
  const [status, setStatus] = useState<PlayerStatus>("在籍");
  const [birthday, setBirthday] = useState("");
  const [birthdayVisible, setBirthdayVisible] = useState(true);
  const [prevId, setPrevId] = useState<string | null>(null);
  const [nextId, setNextId] = useState<string | null>(null);
  const [fiscalYear, setFiscalYear] = useState(CURRENT_FISCAL_YEAR);
  const [statLines, setStatLines] = useState<StatLineWithDate[]>([]);
  const [statCategories, setStatCategories] = useState<TeamStatCategory[]>([]);
  const [statEntries, setStatEntries] = useState<StatEntryWithDate[]>([]);
  const [sportsTestRecords, setSportsTestRecords] = useState<SportsTestRecord[]>([]);
  const [growthRecords, setGrowthRecords] = useState<PlayerGrowthRecord[]>([]);
  const [skillTests, setSkillTests] = useState<SkillTest[]>([]);
  const [skillProgress, setSkillProgress] = useState<PlayerSkillTestProgress[]>([]);
  const [teamAverageRow, setTeamAverageRow] = useState<TeamGameStatAveragesRow | null>(null);
  const [teamAverageRows, setTeamAverageRows] = useState<TeamCustomAverageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [sportsTestView, setSportsTestView] = useState<"table" | "chart">("table");
  const [sportsTestChartMetric, setSportsTestChartMetric] = useState<SportsTestMetric>(
    SPORTS_TEST_RANKING_METRICS[0].value,
  );
  const [sportsTestChartRange, setSportsTestChartRange] = useState<"year" | "all">("year");

  // players一覧側と同様、保護者(一般・運営)は自分に紐づく選手のカルテのみ閲覧できる。
  // playersテーブル自体はRLS上チーム全員分が見えてしまうため、ここで自分の子どもかどうかを
  // 確認して、そうでなければ一覧に戻す(URL直打ち対策)。
  useEffect(() => {
    if (!hasKarteTabAccess(plan)) {
      setAuthorized(false);
      router.replace("/home");
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
        .eq("player_id", params.playerId)
        .eq("profile_id", userId)
        .maybeSingle();
      if (link) {
        setAuthorized(true);
      } else {
        setAuthorized(false);
        router.replace("/karte/players");
      }
    })();
  }, [isStaff, userId, params.playerId, plan, router]);

  useUnsavedChangesGuard(
    editing &&
      player !== null &&
      (sei !== player.sei ||
        mei !== player.mei ||
        seiKana !== (player.sei_kana ?? "") ||
        meiKana !== (player.mei_kana ?? "") ||
        grade !== (player.grade ?? "") ||
        number !== (player.number ?? "") ||
        JSON.stringify([...positions].sort()) !== JSON.stringify([...player.positions].sort()) ||
        status !== player.status ||
        birthday !== (player.birthday ?? "") ||
        birthdayVisible !== player.birthday_visible),
  );

  function startEdit() {
    if (!player) return;
    setSei(player.sei);
    setMei(player.mei);
    setSeiKana(player.sei_kana ?? "");
    setMeiKana(player.mei_kana ?? "");
    setGrade(player.grade ?? "");
    setNumber(player.number ?? "");
    setPositions(player.positions);
    setStatus(player.status);
    setBirthday(player.birthday ?? "");
    setBirthdayVisible(player.birthday_visible);
    setDeleteConfirm(false);
    setEditing(true);
  }

  function togglePos(p: Position) {
    setPositions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function handleSave() {
    if (!player) return;
    if (!sei.trim() || !mei.trim()) {
      toast("氏名を入力してください");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("players")
      .update({
        sei: sei.trim(),
        mei: mei.trim(),
        sei_kana: seiKana.trim() || null,
        mei_kana: meiKana.trim() || null,
        grade: grade || null,
        number: number.trim() || null,
        positions,
        status,
        birthday: birthday || null,
        birthday_visible: birthdayVisible,
      })
      .eq("id", player.id);
    setSaving(false);
    if (error) {
      toast(`更新に失敗しました: ${error.message}`);
      return;
    }
    toast("選手情報を更新しました");
    setEditing(false);
    load();
  }

  async function handleDelete() {
    if (!player) return;
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(false), 3000);
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("players").delete().eq("id", player.id);
    if (error) {
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    toast("選手を削除しました");
    router.push("/karte/players");
  }

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    // 検定はスタッフの場合SkillTestPanel(直接編集)を使うため、元データの取得自体が不要。
    // 保護者は従来通り読み取り専用の一覧を表示する(検定ランクの変更は
    // /karte/team/skill-testsの申請フロー経由)。
    const [{ data: p }, { data: lines }, { data: categories }, { data: entries }, { data: tests }, { data: growth }, { data: skTests }, { data: skProgress }] =
      await Promise.all([
        supabase.from("players").select("*").eq("id", params.playerId).single(),
        supabase
          .from("game_player_stat_lines")
          .select("*, game_matches(opponent, game_number, schedules(date, fiscal_year_override))")
          .eq("player_id", params.playerId)
          .returns<StatLineWithDate[]>(),
        supabase.from("team_stat_categories").select("*").order("position", { ascending: true }),
        supabase
          .from("game_player_stat_entries")
          .select("*, game_matches(opponent, game_number, schedules(date, fiscal_year_override))")
          .eq("player_id", params.playerId)
          .returns<StatEntryWithDate[]>(),
        supabase
          .from("sports_test_records")
          .select("*")
          .eq("player_id", params.playerId)
          .order("fiscal_year", { ascending: true })
          .order("quarter", { ascending: true }),
        supabase
          .from("player_growth_records")
          .select("*")
          .eq("player_id", params.playerId)
          .order("measured_on", { ascending: false })
          .limit(6),
        isStaff ? Promise.resolve({ data: null }) : supabase.from("skill_tests").select("*").order("created_at", { ascending: true }),
        isStaff
          ? Promise.resolve({ data: null })
          : supabase
              .from("player_skill_test_progress")
              .select("*")
              .eq("player_id", params.playerId)
              .order("created_at", { ascending: false }),
      ]);
    setPlayer(p ?? null);
    setSkillTests(skTests ?? []);
    setSkillProgress(skProgress ?? []);
    if (p) {
      const { data: siblings } = await supabase
        .from("players")
        .select("id, grade, number")
        .eq("status", p.status);
      const ordered = sortPlayers(siblings ?? []);
      const idx = ordered.findIndex((s) => s.id === p.id);
      setPrevId(idx > 0 ? ordered[idx - 1].id : null);
      setNextId(idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1].id : null);
    } else {
      setPrevId(null);
      setNextId(null);
    }
    setStatLines(lines ?? []);
    setStatCategories(categories ?? []);
    setStatEntries(entries ?? []);
    setSportsTestRecords(tests ?? []);
    setGrowthRecords(growth ?? []);
    setLoading(false);
  }, [params.playerId, isStaff]);

  useEffect(() => {
    load();
  }, [load]);

  // チーム平均は、個人スタッツと違って他選手の生データに触れずに済むよう、集計だけを
  // 返す専用RPC(保護者向け/players/[id]/statsと同じもの)を使う。スタッフでも同じ値になる。
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      if (usesDetailedBasketballStats(sport)) {
        const { data } = await supabase.rpc("team_game_stat_averages", { p_fiscal_year: fiscalYear });
        setTeamAverageRow(data?.[0] ?? null);
      } else {
        const { data } = await supabase.rpc("team_stat_category_averages", { p_fiscal_year: fiscalYear });
        setTeamAverageRows(data ?? []);
      }
    })();
  }, [fiscalYear, sport]);

  const seasonLines = statLines
    .filter((l) => {
      const date = l.game_matches?.schedules?.date;
      if (!date) return false;
      return effectiveFiscalYear(date, l.game_matches?.schedules?.fiscal_year_override ?? null) === fiscalYear;
    })
    .sort((a, b) =>
      compareGameDesc(
        { date: a.game_matches?.schedules?.date, gameNumber: a.game_matches?.game_number },
        { date: b.game_matches?.schedules?.date, gameNumber: b.game_matches?.game_number },
      ),
    );
  const seasonAverages = computeSeasonAverages(seasonLines);
  const seasonTotals = computeSeasonTotals(seasonLines);
  const gameRows = seasonLines.map((l) => ({
    label: `${formatDateLabel(l.game_matches?.schedules?.date ?? "")} vs ${l.game_matches?.opponent ?? "-"}`,
    averages: computeSeasonAverages([l]),
  }));

  // バスケットボール・ミニバスケットボール以外の競技向け(チームが自由に定義したカスタム項目)。
  const seasonEntries = statEntries.filter((e) => {
    const date = e.game_matches?.schedules?.date;
    if (!date) return false;
    return effectiveFiscalYear(date, e.game_matches?.schedules?.fiscal_year_override ?? null) === fiscalYear;
  });
  const customSeasonAverages = computeCustomSeasonAverages(seasonEntries, statCategories);
  const customGameRows = Array.from(new Set(seasonEntries.map((e) => e.match_id)))
    .map((matchId) => {
      const matchEntries = seasonEntries.filter((e) => e.match_id === matchId);
      const first = matchEntries[0];
      return {
        date: first.game_matches?.schedules?.date ?? "",
        gameNumber: first.game_matches?.game_number,
        label: `${formatDateLabel(first.game_matches?.schedules?.date ?? "")} vs ${first.game_matches?.opponent ?? "-"}`,
        averages: computeCustomSeasonAverages(matchEntries, statCategories),
      };
    })
    .sort((a, b) => compareGameDesc(a, b));

  const sportsTestRecordsForYear = sportsTestRecords.filter((r) => r.fiscal_year === fiscalYear);

  if (loading || !authorized) {
    return (
      <PageShell header={<AppHeader title="カルテ" variant="detail" backHref="/karte/players" accessBadge={isStaff ? "coach" : undefined} />}>
        <EmptyState>読み込み中…</EmptyState>
      </PageShell>
    );
  }

  if (!player) {
    return (
      <PageShell header={<AppHeader title="カルテ" variant="detail" backHref="/karte/players" accessBadge={isStaff ? "coach" : undefined} />}>
        <EmptyState>選手が見つかりません</EmptyState>
      </PageShell>
    );
  }

  return (
    <PageShell header={<AppHeader title={`${playerFullName(player)} / カルテ`} variant="detail" backHref="/karte/players" accessBadge={isStaff ? "coach" : undefined} />}>
      {isStaff && (
        // 保護者は自分に紐づく選手しかアクセスできないため、兄弟選手間のページ送りは
        // スタッフ限定にする(保護者に他選手のIDへの導線を与えないため)。
        <div className="flex items-center justify-between mb-3">
          {prevId ? (
            <Link
              href={`/karte/players/${prevId}`}
              aria-label="前の選手"
              className="w-[30px] h-[30px] rounded-lg bg-white border border-line flex items-center justify-center text-base text-heading"
            >
              ‹
            </Link>
          ) : (
            <span className="w-[30px] h-[30px] rounded-lg bg-white border border-line flex items-center justify-center text-base text-line">
              ‹
            </span>
          )}
          {nextId ? (
            <Link
              href={`/karte/players/${nextId}`}
              aria-label="次の選手"
              className="w-[30px] h-[30px] rounded-lg bg-white border border-line flex items-center justify-center text-base text-heading"
            >
              ›
            </Link>
          ) : (
            <span className="w-[30px] h-[30px] rounded-lg bg-white border border-line flex items-center justify-center text-base text-line">
              ›
            </span>
          )}
        </div>
      )}

      <SectionLabel
        action={
          isStaff &&
          !editing && (
            <button
              type="button"
              onClick={startEdit}
              className="flex-none text-[11px] font-bold text-orange border border-orange rounded-full px-2.5 py-1 bg-orange/8"
            >
              編集する
            </button>
          )
        }
      >
        基本情報
      </SectionLabel>
      {editing ? (
        <>
          <Card>
            <div className="flex gap-2">
              <div className="flex-1">
                <FieldLabel>氏</FieldLabel>
                <input className={inputClass()} value={sei} onChange={(e) => setSei(e.target.value)} />
              </div>
              <div className="flex-1">
                <FieldLabel>名</FieldLabel>
                <input className={inputClass()} value={mei} onChange={(e) => setMei(e.target.value)} />
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <div className="flex-1">
                <FieldLabel>氏(カナ)</FieldLabel>
                <input className={inputClass()} value={seiKana} onChange={(e) => setSeiKana(e.target.value)} />
              </div>
              <div className="flex-1">
                <FieldLabel>名(カナ)</FieldLabel>
                <input className={inputClass()} value={meiKana} onChange={(e) => setMeiKana(e.target.value)} />
              </div>
            </div>

            <div className="mt-3">
              <FieldLabel>学年</FieldLabel>
              {category === "その他" ? (
                <div className="text-xs text-ink-soft bg-paper border border-dashed border-line rounded-lg px-3 py-2.5">
                  このカテゴリーでは学年を登録しません。
                </div>
              ) : status === "OB・OG" ? (
                <input
                  type="number"
                  min={GRADUATION_GRADE_BY_CATEGORY[category] ?? undefined}
                  className={inputClass()}
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                />
              ) : (
                <select className={inputClass()} value={grade} onChange={(e) => setGrade(e.target.value as Grade | "")}>
                  <option value="">選択してください</option>
                  {gradeOptions.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[11.5px] font-bold text-ink-soft">誕生日</div>
                <div className="flex items-center gap-1.5">
                  <div className="text-[10.5px] font-bold text-ink-soft">公開する</div>
                  <Switch checked={birthdayVisible} onChange={setBirthdayVisible} />
                </div>
              </div>
              <BirthdaySelect value={birthday} onChange={setBirthday} />
              <div className="text-xs text-ink-soft mt-1">
                オフにすると、誕生日お祝い通知やカレンダーの🎂表示の対象外になります。
              </div>
            </div>

            <div className="mt-3">
              <FieldLabel>背番号(リバ)</FieldLabel>
              <input className={inputClass()} value={number} onChange={(e) => setNumber(e.target.value)} />
            </div>

            <div className="mt-3">
              <FieldLabel>ポジション(複数選択可)</FieldLabel>
              <div className="flex gap-1.5 flex-wrap">
                {positionOptions.map((p) => (
                  <SegButton
                    key={p}
                    variant="small"
                    active={positions.includes(p)}
                    onClick={() => togglePos(p)}
                    className="flex-none px-3.5"
                  >
                    {p}
                  </SegButton>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <FieldLabel>ステータス</FieldLabel>
              <select className={inputClass()} value={status} onChange={(e) => setStatus(e.target.value as PlayerStatus)}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <SubmitButton onClick={handleSave} disabled={saving}>
              {saving ? "保存中…" : "保存する"}
            </SubmitButton>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="w-full mt-2.5 text-center py-2 rounded-lg font-bold text-[12.5px] border border-line bg-white text-ink-soft"
            >
              キャンセル
            </button>
          </Card>

          <div className="font-mono text-[11px] tracking-widest uppercase text-ink-soft mt-4 mb-2.5">削除</div>
          <Card>
            <button
              type="button"
              onClick={handleDelete}
              className="w-full text-center py-2 rounded-lg font-bold text-[12.5px] border bg-white"
              style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
            >
              {deleteConfirm ? "もう一度タップで削除確定" : "この選手を削除する"}
            </button>
          </Card>
        </>
      ) : (
        <Card>
          <div className="flex items-center gap-2.5">
            <NumChip num={player.number ?? "-"} />
            <div>
              <div className="font-bold text-[13.5px]">{playerFullName(player)}</div>
              {(player.sei_kana || player.mei_kana) && (
                <div className="text-[11px] text-ink-soft mt-0.5">
                  {player.sei_kana ?? ""}
                  {player.mei_kana ?? ""}
                </div>
              )}
              <div className="text-[11px] text-ink-soft mt-0.5">
                {player.status === "OB・OG" ? obogCohortLabel(player.grade, category) : gradeLabel(player.grade, category)}
                ・{player.positions.length > 0 ? player.positions.join("/") : "ポジション未設定"}
              </div>
            </div>
          </div>
          <div className="text-[11px] text-ink-soft mt-2">
            ステータス: {player.status}
            {player.birthday && ` / 誕生日: ${formatFullDateLabel(player.birthday)}`}
          </div>
        </Card>
      )}

      <div className="mt-3">
        <FieldLabel>年度</FieldLabel>
        <InlineSelect
          value={String(fiscalYear)}
          onChange={(v) => setFiscalYear(Number(v))}
          options={FISCAL_YEAR_OPTIONS.map((y) => ({ value: String(y), label: `${y}年度` }))}
        />
      </div>

      <SectionLabel>試合スタッツ(試合ごと)</SectionLabel>
      {usesDetailedBasketballStats(sport) ? (
        gameRows.length === 0 ? (
          <Card>
            <EmptyState>この年度の出場記録がありません</EmptyState>
          </Card>
        ) : (
          <div className="bg-white border border-line rounded-lg overflow-auto max-h-[65vh] mb-2.5">
            <table className="border-collapse text-[11.5px] w-full">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 h-9 bg-paper z-30 text-left px-2.5 border-b border-line whitespace-nowrap">
                    試合
                  </th>
                  {columns.map((c) => {
                    if (c.key === "rebDef") return null;
                    if (c.key === "rebOff") {
                      return (
                        <th
                          key="reb"
                          colSpan={2}
                          className="sticky top-0 h-9 bg-paper z-20 w-[100px] min-w-[100px] px-1 border-b border-line font-bold whitespace-nowrap text-center text-ink-soft"
                        >
                          <div>REB</div>
                          <div className="flex justify-center gap-2 text-[8px] leading-none font-bold">
                            <span>OFF</span>
                            <span>DEF</span>
                          </div>
                        </th>
                      );
                    }
                    return (
                      <th
                        key={c.key}
                        className={`sticky top-0 h-9 bg-paper z-20 ${colWidthClass(c.key)} px-1 border-b border-line font-bold whitespace-nowrap text-center text-ink-soft`}
                      >
                        {c.abbr}
                      </th>
                    );
                  })}
                </tr>
                <tr className="bg-paper">
                  <th className="sticky left-0 top-9 h-9 bg-paper z-30 text-left px-2.5 border-b border-line whitespace-nowrap font-bold">
                    チーム平均
                  </th>
                  {columns.map((c) => {
                    if (c.key === "rebDef") return null;
                    const teamAverages = teamAverageRow ? toSeasonStatAverages(teamAverageRow) : null;
                    if (c.key === "rebOff") {
                      return (
                        <th
                          key="reb"
                          colSpan={2}
                          className="sticky top-9 h-9 bg-paper z-20 w-[100px] min-w-[100px] px-1 text-center font-mono font-bold border-b border-line whitespace-nowrap"
                        >
                          {teamAverages ? (
                            <>
                              <div>{teamAverages.reb}</div>
                              <div className="text-ink-soft text-[9.5px] font-normal">
                                {teamAverages.rebOff} - {teamAverages.rebDef}
                              </div>
                            </>
                          ) : (
                            "-"
                          )}
                        </th>
                      );
                    }
                    const v = teamAverages ? (teamAverages[c.key] as number | null) : null;
                    return (
                      <th
                        key={c.key}
                        className={`sticky top-9 h-9 bg-paper z-20 ${colWidthClass(c.key)} px-1 text-center font-mono font-bold border-b border-line whitespace-nowrap ${
                          c.key === "eff" && v !== null && v < 0 ? "text-danger" : ""
                        }`}
                      >
                        {teamAverages ? <StatCell statKey={c.key} averages={teamAverages} /> : "-"}
                      </th>
                    );
                  })}
                </tr>
                <tr className="bg-paper">
                  <th className="sticky left-0 top-[72px] h-9 bg-paper z-30 text-left px-2.5 border-b border-line whitespace-nowrap font-bold">
                    シーズン合計
                  </th>
                  {columns.map((c) => {
                    if (c.key === "rebDef") return null;
                    if (c.key === "rebOff") {
                      return (
                        <th
                          key="reb"
                          colSpan={2}
                          className="sticky top-[72px] h-9 bg-paper z-20 w-[100px] min-w-[100px] px-1 text-center font-mono font-bold border-b border-line whitespace-nowrap"
                        >
                          <div>{seasonTotals.reb}</div>
                          <div className="text-ink-soft text-[9.5px] font-normal">
                            {seasonTotals.rebOff} - {seasonTotals.rebDef}
                          </div>
                        </th>
                      );
                    }
                    if (c.key === "eff") {
                      return (
                        <th
                          key={c.key}
                          className={`sticky top-[72px] h-9 bg-paper z-20 ${colWidthClass(c.key)} px-1 text-center font-mono font-bold border-b border-line whitespace-nowrap text-ink-soft`}
                        >
                          -
                        </th>
                      );
                    }
                    if (c.key === "fgPct" || c.key === "ftPct" || c.key === "twoPct" || c.key === "threePct") {
                      const made =
                        c.key === "fgPct"
                          ? seasonTotals.fgMade
                          : c.key === "ftPct"
                            ? seasonTotals.ftMade
                            : c.key === "twoPct"
                              ? seasonTotals.twoMade
                              : seasonTotals.threeMade;
                      const att =
                        c.key === "fgPct"
                          ? seasonTotals.fgAtt
                          : c.key === "ftPct"
                            ? seasonTotals.ftAtt
                            : c.key === "twoPct"
                              ? seasonTotals.twoAtt
                              : seasonTotals.threeAtt;
                      return (
                        <th
                          key={c.key}
                          className={`sticky top-[72px] h-9 bg-paper z-20 ${colWidthClass(c.key)} px-1 text-center font-mono font-bold border-b border-line whitespace-nowrap`}
                        >
                          <div className="leading-tight">
                            <div>{att > 0 ? `${made}/${att}` : "-"}</div>
                            <div className="text-[9.5px] text-ink-soft font-normal">{pctString(made, att)}</div>
                          </div>
                        </th>
                      );
                    }
                    const v = seasonTotals[c.key as keyof typeof seasonTotals] as number;
                    return (
                      <th
                        key={c.key}
                        className={`sticky top-[72px] h-9 bg-paper z-20 ${colWidthClass(c.key)} px-1 text-center font-mono font-bold border-b border-line whitespace-nowrap`}
                      >
                        {v}
                      </th>
                    );
                  })}
                </tr>
                <tr className="bg-paper">
                  <th className="sticky left-0 top-[108px] h-9 bg-paper z-30 text-left px-2.5 border-b border-line whitespace-nowrap font-bold">
                    シーズン平均
                  </th>
                  {columns.map((c) => {
                    if (c.key === "rebDef") return null;
                    if (c.key === "rebOff") {
                      return (
                        <th
                          key="reb"
                          colSpan={2}
                          className="sticky top-[108px] h-9 bg-paper z-20 w-[100px] min-w-[100px] px-1 text-center font-mono font-bold border-b border-line whitespace-nowrap"
                        >
                          <div>{seasonAverages.reb}</div>
                          <div className="text-ink-soft text-[9.5px] font-normal">
                            {seasonAverages.rebOff} - {seasonAverages.rebDef}
                          </div>
                        </th>
                      );
                    }
                    const v = seasonAverages[c.key] as number | null;
                    return (
                      <th
                        key={c.key}
                        className={`sticky top-[108px] h-9 bg-paper z-20 ${colWidthClass(c.key)} px-1 text-center font-mono font-bold border-b border-line whitespace-nowrap ${
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
                    {columns.map((c) => {
                      if (c.key === "rebDef") return null;
                      if (c.key === "rebOff") {
                        return (
                          <td
                            key="reb"
                            colSpan={2}
                            className="w-[100px] min-w-[100px] px-1 py-2 text-center font-mono border-b border-line last:border-b-0 whitespace-nowrap"
                          >
                            <div className="font-bold">{row.averages.reb}</div>
                            <div className="text-ink-soft text-[10px]">
                              {row.averages.rebOff} - {row.averages.rebDef}
                            </div>
                          </td>
                        );
                      }
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
        )
      ) : statCategories.length === 0 ? (
        <Card>
          <EmptyState>まだスタッツ項目がありません</EmptyState>
        </Card>
      ) : customGameRows.length === 0 ? (
        <Card>
          <EmptyState>この年度の出場記録がありません</EmptyState>
        </Card>
      ) : (
        <div className="bg-white border border-line rounded-lg overflow-auto max-h-[65vh] mb-2.5">
          <table className="border-collapse text-[11.5px] w-full">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 h-9 bg-paper z-30 text-left px-2.5 border-b border-line whitespace-nowrap">
                  試合
                </th>
                {statCategories.map((c) => (
                  <th
                    key={c.id}
                    className="sticky top-0 h-9 bg-paper z-20 w-[58px] min-w-[58px] px-1 border-b border-line font-bold whitespace-nowrap text-center text-ink-soft"
                  >
                    {c.name}
                  </th>
                ))}
              </tr>
              <tr className="bg-paper">
                <th className="sticky left-0 top-9 h-9 bg-paper z-30 text-left px-2.5 border-b border-line whitespace-nowrap font-bold">
                  チーム平均
                </th>
                {statCategories.map((c) => {
                  const row = teamAverageRows.find((r) => r.category_id === c.id);
                  return (
                    <th
                      key={c.id}
                      className="sticky top-9 h-9 bg-paper z-20 w-[58px] min-w-[58px] px-1 text-center font-mono font-bold border-b border-line whitespace-nowrap"
                    >
                      {!row || row.player_count === 0 ? "-" : row.avg_value}
                    </th>
                  );
                })}
              </tr>
              <tr className="bg-paper">
                <th className="sticky left-0 top-[72px] h-9 bg-paper z-30 text-left px-2.5 border-b border-line whitespace-nowrap font-bold">
                  シーズン平均
                </th>
                {statCategories.map((c) => (
                  <th
                    key={c.id}
                    className="sticky top-[72px] h-9 bg-paper z-20 w-[58px] min-w-[58px] px-1 text-center font-mono font-bold border-b border-line whitespace-nowrap"
                  >
                    {customSeasonAverages.averages[c.id] ?? 0}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customGameRows.map((row, i) => (
                <tr key={i}>
                  <td className="sticky left-0 bg-white z-10 px-2.5 py-2 whitespace-nowrap border-b border-line last:border-b-0">
                    {row.label}
                  </td>
                  {statCategories.map((c) => (
                    <td
                      key={c.id}
                      className="w-[58px] min-w-[58px] px-1 py-2 text-center font-mono border-b border-line last:border-b-0 whitespace-nowrap"
                    >
                      {row.averages.totals[c.id] ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {usesDetailedBasketballStats(sport) && (
        <ul className="text-[10.5px] text-ink-soft leading-relaxed mb-2.5 pl-4 list-disc space-y-0.5">
          <li>PTS:得点</li>
          <li>FG%:フィールドゴール成功率(下段は成功数/試投数)</li>
          {usesThreePointScoring(sport) && (
            <>
              <li>2P%:2ポイントシュート成功率(下段は成功数/試投数)</li>
              <li>3P%:3ポイントシュート成功率(下段は成功数/試投数)</li>
            </>
          )}
          <li>FT%:フリースロー成功率(下段は成功数/試投数)</li>
          <li>AST:アシスト</li>
          <li>REB:リバウンド(下段左はオフェンス(OFF)、右はディフェンス(DEF))</li>
          <li>BLK:ブロック</li>
          <li>ST:スティール</li>
          <li>TO:ターンオーバー</li>
          <li>FOULS:ファウル</li>
          <li>EFF:得点+リバウンド+アシスト+スティール+ブロック−(FG失敗+FT失敗+ターンオーバー)</li>
        </ul>
      )}

      {hasSportsTestAccess(plan) && (
        <>
      <SectionLabel>スポーツテスト(四半期ごと)</SectionLabel>
      {sportsTestRecords.length > 0 && (
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="flex gap-4">
            <TextTab active={sportsTestView === "table"} onClick={() => setSportsTestView("table")}>
              表
            </TextTab>
            <TextTab active={sportsTestView === "chart"} onClick={() => setSportsTestView("chart")}>
              グラフ
            </TextTab>
          </div>
          {sportsTestView === "chart" && (
            <div className="flex gap-1.5">
              <select
                className="appearance-none bg-white border border-line rounded-lg px-2 py-1 text-[11.5px] font-bold text-ink"
                value={sportsTestChartMetric}
                onChange={(e) => setSportsTestChartMetric(e.target.value as SportsTestMetric)}
              >
                {SPORTS_TEST_RANKING_METRICS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <select
                className="appearance-none bg-white border border-line rounded-lg px-2 py-1 text-[11.5px] font-bold text-ink"
                value={sportsTestChartRange}
                onChange={(e) => setSportsTestChartRange(e.target.value as "year" | "all")}
              >
                <option value="year">今年度</option>
                <option value="all">全年度</option>
              </select>
            </div>
          )}
        </div>
      )}
      {sportsTestView === "chart" && sportsTestRecords.length > 0 ? (
        <Card>
          <LineTrendChart
            points={
              sportsTestChartRange === "year"
                ? QUARTERS.map((q) => {
                    const record = sportsTestRecordsForYear.find((r) => r.quarter === q);
                    const metric = SPORTS_TEST_RANKING_METRICS.find((m) => m.value === sportsTestChartMetric)!;
                    return {
                      label: `Q${q}`,
                      value: record && !record.not_conducted ? metric.extract(record) : null,
                    };
                  })
                : sportsTestRecords
                    .filter((r) => !r.not_conducted)
                    .map((r) => {
                      const metric = SPORTS_TEST_RANKING_METRICS.find((m) => m.value === sportsTestChartMetric)!;
                      return {
                        label: `${r.fiscal_year}/Q${r.quarter}`,
                        value: metric.extract(r),
                      };
                    })
            }
          />
        </Card>
      ) : (
        <div className="bg-white border border-line rounded-lg overflow-auto max-h-[65vh] mb-2.5">
          <table className="border-collapse text-[11.5px] w-full">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 h-11 bg-paper z-30 text-left px-2.5 border-b border-line whitespace-nowrap">
                  四半期
                </th>
                {SPORTS_TEST_RANKING_METRICS.map((m) => (
                  <th
                    key={m.value}
                    className="sticky top-0 h-11 bg-paper z-20 w-[54px] min-w-[54px] px-1 border-b border-line font-bold text-center leading-tight text-ink-soft"
                  >
                    <div className="whitespace-nowrap">{m.abbrLines[0]}</div>
                    <div className="whitespace-nowrap">{m.abbrLines[1]}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {QUARTERS.map((q) => {
                const record = sportsTestRecordsForYear.find((r) => r.quarter === q);
                return (
                  <tr key={q}>
                    <td className="sticky left-0 bg-white z-10 px-2.5 py-2 whitespace-nowrap border-b border-line last:border-b-0 font-bold">
                      Q{q}
                    </td>
                    {SPORTS_TEST_RANKING_METRICS.map((m) => {
                      const v = record && !record.not_conducted ? m.extract(record) : null;
                      return (
                        <td
                          key={m.value}
                          className="w-[54px] min-w-[54px] px-1 py-2 text-center font-mono border-b border-line last:border-b-0"
                        >
                          {v === null ? "-" : v}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Link
        href={`/players/${player.id}/sports-test`}
        className="block mb-2.5 text-center py-2 rounded-lg font-bold text-[12px] border border-line text-ink-soft bg-white"
      >
        スポーツテストを入力・編集する
      </Link>
        </>
      )}

      {hasSkillTestAccess(plan) && (
        <>
          <SectionLabel>検定</SectionLabel>
          {isStaff ? (
            <SkillTestPanel playerId={player.id} />
          ) : (
            // 保護者はランクの直接編集はできない(ランク変更は/karte/team/skill-tests
            // の申請フロー経由)。現在のランクの閲覧のみ。
            <Card>
              {skillTests.length === 0 ? (
                <div className="text-xs text-ink-soft">まだ検定がありません</div>
              ) : (
                <div className="text-[13.5px]">
                  {skillTests.map((test) => {
                    const current = skillProgress.find((row) => row.skill_test_id === test.id);
                    return (
                      <div
                        key={test.id}
                        className="flex items-center justify-between py-1.5 first:pt-0 last:pb-0 border-b border-line last:border-b-0"
                      >
                        <span className="font-bold">{test.name}</span>
                        <span className="text-ink-soft">{current ? current.level_label : "未設定"}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}
        </>
      )}

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
          className="block mt-3 text-center py-2 rounded-lg font-bold text-[12px] border border-line text-ink-soft bg-paper"
        >
          記録を入力・編集する
        </Link>
      </Card>

      {canManagePlayers(role) && (
        <>
          <SectionLabel>選手メモ</SectionLabel>
          <Link href={`/players/${player.id}/notes`}>
            <Card className="cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="font-bold text-[13.5px]">メモを見る・編集する</div>
                <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
              </div>
            </Card>
          </Link>
        </>
      )}

      {canManagePlayers(role) && hasAiAnalysisAccess(plan) && (
        <>
          <SectionLabel>選手分析</SectionLabel>
          <Link href={`/karte/players/${player.id}/analysis`}>
            <Card className="cursor-pointer">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-[13.5px]">AI分析・フィードバック</div>
                  <div className="text-[11.5px] text-ink-soft mt-1">AI分析・フィードバック・分析用データ抽出</div>
                </div>
                <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
              </div>
            </Card>
          </Link>
        </>
      )}
    </PageShell>
  );
}
