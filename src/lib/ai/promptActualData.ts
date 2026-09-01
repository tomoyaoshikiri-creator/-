import { fiscalYearLabel } from "@/lib/format";
import type { CustomStatCategoryInfo, PlayerAnalysisData, StatsData, TeamAnalysisData } from "./types";

function fmt(v: number | null | undefined, unit = ""): string {
  return v === null || v === undefined ? "データなし" : `${v}${unit}`;
}

function evaluationDirectionLabel(direction: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER" | "NEUTRAL"): string {
  if (direction === "HIGHER_IS_BETTER") return "高い方が良い";
  if (direction === "LOWER_IS_BETTER") return "低い方が良い";
  return "評価方向なし(数値の高低だけで優劣を判断しない)";
}

// スポーツテストの各項目について「何を測っているか」と「どちらが良い方向か」を凡例として
// 一度だけ示す(絶対的な基準値・平均・パーセンタイルではないことに注意)。四半期ごとの値の
// 行では数値のみを列挙し、同じ凡例を毎回繰り返してトークンを浪費しない。
function sportsTestLegend(values: Record<string, { label: string; unit: string; evaluationDirection: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER" | "NEUTRAL"; measuredQuality: string }>): string {
  return Object.values(values)
    .map((v) => `${v.label}: ${v.measuredQuality}(${evaluationDirectionLabel(v.evaluationDirection)})`)
    .join(" / ");
}

// aggregationTypeごとに、シーズン集計値(seasonTotal/seasonAverage)が何を意味するか、
// 何件のデータから算出したかをAIに明示する行を作る。欠損(記録がない選手・試合)を0として
// 扱わず、記録が存在するものだけを対象に算出していることも明記する。
function categorySummaryLines(c: CustomStatCategoryInfo, scope: "player" | "team", totalGameCount: number): string[] {
  const lines: string[] = [];
  if (c.aggregationType === "SUM") {
    lines.push("集計方法: 合計値として見るべき項目");
    if (c.seasonTotal === null) {
      lines.push("  この項目の記録はまだありません");
    } else {
      // 数値ごとに1行・1ラベルとし、「合計値」と「試合数」のような意味の異なる数値が
      // 隣接して誤読されないようにする(試合数の行を先に置き、対象範囲を明確にしてから
      // 合計値・平均値を示す)。
      lines.push(`  対象試合数: ${c.recordedGameCount}/${totalGameCount}試合(この項目の記録がある試合数/シーズン全体の試合数)`);
      lines.push(`  シーズン合計値: ${c.seasonTotal}(記録が存在するエントリの合計。記録のない試合は0として合算していません)`);
      lines.push(`  試合平均値: ${c.seasonAverage}(上記の対象試合数における1試合あたりの平均。記録のない試合は0として平均に含めていません)`);
    }
  } else if (c.aggregationType === "AVERAGE") {
    lines.push("集計方法: 平均値として見るべき項目");
    if (c.seasonAverage === null) {
      lines.push("  この項目の記録はまだありません");
    } else {
      lines.push(`  記録件数: ${c.recordedEntryCount}件(選手×試合の記録数。記録のない選手・試合は含まれていません)`);
      lines.push(`  単純平均値: ${c.seasonAverage}(上記の記録件数のみを対象とした平均。合計値には意味がないため算出していません)`);
    }
  } else if (c.aggregationType === "RATE") {
    // チーム集計上の制約(複数選手の値を単純平均せざるを得ない)は、選手個人分析では
    // 発生しない(本人自身の記録値をそのまま扱えるため)。scopeに応じて文言を分ける。
    if (scope === "team") {
      lines.push("集計方法: 割合・率(選手ごとの成功数・試行数のデータがないため、チーム全体の正確な合算率は算出できません)");
    } else {
      lines.push("集計方法: 割合・率として見るべき項目(本人の記録値)");
    }
    if (c.seasonAverage === null) {
      lines.push("  この項目の記録はまだありません");
    } else if (scope === "team") {
      lines.push(`  記録件数: ${c.recordedEntryCount}件、記録選手数: ${c.recordedPlayerCount}名`);
      lines.push(`  単純平均率(参考値。チーム全体の正確な率ではありません): ${c.seasonAverage}%`);
      if (c.recordedPlayerCount === 1) {
        lines.push("  (この項目は1名分の記録のみに基づく参考値であり、チーム全体の傾向を表すものではありません)");
      }
    } else {
      lines.push(`  記録件数: ${c.recordedEntryCount}件`);
      lines.push(`  シーズン平均率: ${c.seasonAverage}%`);
    }
  } else {
    lines.push(
      "集計方法: 指定なし(この項目は集計方法が定義されていないため、チーム合計・チーム平均による評価は行わないでください。個々の記録値・試合ごとの記録値のみを参考にしてください)",
    );
  }
  return lines;
}

function statsToLines(stats: StatsData, scope: "player" | "team", rosterCount?: number): string[] {
  const lines: string[] = [];
  if (stats.kind === "basketball") {
    lines.push(`■ 試合スタッツ(シーズン平均、試合数: ${stats.gameCount})`);
    if (stats.gameCount === 0) {
      lines.push("この年度の出場記録はありません");
    } else {
      if (scope === "team") {
        lines.push(
          "(PTS/AST/OREB/DREB/STL/BLK/TO/EFFは出場した各選手自身の平均を単純平均したチーム平均です。FG%/FT%/2P%/3P%はチーム全体の成功数合計÷試投数合計から算出した正確な値です。両者は算出方法が異なります)",
        );
      }
      Object.entries(stats.seasonAverages).forEach(([k, v]) => lines.push(`${k}: ${fmt(v)}`));
      if (stats.games.length > 0) {
        lines.push("");
        lines.push("■ 試合ごとの記録");
        stats.games.forEach((g) => {
          const summary = Object.entries(g.averages)
            .map(([k, v]) => `${k} ${fmt(v)}`)
            .join(" / ");
          lines.push(`${g.label}: ${summary}`);
        });
      }
    }
  } else {
    lines.push(`■ 試合スタッツ(カスタム項目、シーズン合計・平均、試合数: ${stats.gameCount})`);
    if (stats.categories.length === 0) {
      lines.push("スタッツ項目が登録されていません");
    } else if (stats.gameCount === 0) {
      lines.push("この年度の出場記録はありません");
    } else {
      if (stats.categories.some((c) => c.evaluationDirection === null)) {
        lines.push(
          "(評価方向が未設定の項目について: 数値の変化は確認できても、この項目の評価方向が設定されていないため改善・悪化の判断はしないこと。項目名が競技上一般的な指標に似ていても、チームが独自に定義した項目であり、名前だけから評価方向を推測しないこと)",
        );
      }
      stats.categories.forEach((c) => {
        const directionLabel =
          c.evaluationDirection === "HIGHER_IS_BETTER"
            ? "高い方が良い"
            : c.evaluationDirection === "LOWER_IS_BETTER"
              ? "低い方が良い"
              : c.evaluationDirection === "NEUTRAL"
                ? "高低で優劣が決まらない項目"
                : "評価方向は未設定(勝手に高低の優劣を判断しないこと)";
        const meta = [c.unit ? `単位: ${c.unit}` : null, c.description ? `説明: ${c.description}` : null]
          .filter(Boolean)
          .join(", ");
        lines.push(`${c.name}(${directionLabel}${meta ? `, ${meta}` : ""})`);
        lines.push(...categorySummaryLines(c, scope, stats.gameCount).map((l) => `  ${l}`));
      });
      if (stats.games.length > 0) {
        lines.push("");
        lines.push("■ 試合ごとの記録");
        if (scope === "team") {
          lines.push(
            "(「値(M/N名記録)」のMはその試合で記録した選手数、Nは在籍選手数です。記録のない選手は0として扱わず、集計から除外しています。「記録値[...]」の項目は集計方法が定義されていないため自動集計せず、記録された値をそのまま列挙しています)",
          );
        }
        stats.games.forEach((g) => {
          const parts: string[] = [];
          Object.entries(g.values).forEach(([name, v]) => {
            parts.push(scope === "team" && rosterCount ? `${name} ${v.value}(${v.recordedCount}/${rosterCount}名記録)` : `${name} ${v.value}`);
          });
          Object.entries(g.rawValues).forEach(([name, vals]) => {
            parts.push(`${name} 記録値[${vals.join(", ")}]`);
          });
          lines.push(`${g.label}: ${parts.length > 0 ? parts.join(" / ") : "この試合の記録なし"}`);
        });
      }
    }
  }
  return lines;
}

export function buildPlayerActualData(data: PlayerAnalysisData): string {
  const lines: string[] = [];
  lines.push("■ 選手情報");
  lines.push(`氏名: ${data.player.name}`);
  lines.push(`学年: ${data.player.grade}`);
  lines.push(`ポジション・役割: ${data.player.positions.join("/") || "未設定"}`);
  lines.push(`対象年度: ${fiscalYearLabel(data.fiscalYear)}`);
  lines.push("");

  lines.push(...statsToLines(data.stats, "player"));
  lines.push("");

  if (data.sportsTest) {
    lines.push("■ スポーツテスト(時系列)");
    if (data.sportsTest.quarters.length === 0) {
      lines.push("記録なし");
    } else {
      lines.push(
        "(基準値・チーム内平均・パーセンタイル等の絶対評価基準は提供されていません。各項目は本人の過去記録との時系列比較でのみ解釈し、絶対的な「得意/苦手/高い/低い/平均以上/平均以下」等の判定はしないでください。評価方向なしの項目は「改善/低下」等の能力評価語も使わず、数値の変化のみを記述してください)",
      );
      lines.push(`[各項目の凡例] ${sportsTestLegend(data.sportsTest.quarters[0].values)}`);
      data.sportsTest.quarters.forEach((q) => {
        const values = Object.values(q.values)
          .map((v) => `${v.label} ${fmt(v.value, v.unit)}`)
          .join(" / ");
        lines.push(`${q.fiscalYear}年度 Q${q.quarter}: ${values}`);
      });
    }
    lines.push("");
  }

  lines.push("■ 練習参加状況");
  lines.push(`開催練習数: ${data.practice.practicesHeld}回 / 出欠記録あり: ${data.practice.attendanceRecordedCount}回 / 出欠データカバー率: ${fmt(data.practice.attendanceCoverageRate, "%")}`);
  lines.push(`出席: ${data.practice.attended}回 / 遅刻早退: ${data.practice.late}回 / 見学: ${data.practice.observed}回 / 欠席: ${data.practice.absent}回`);
  lines.push(`年度内開催数ベースの参加率(参考値): ${fmt(data.practice.fullYearParticipationRate, "%")}`);
  lines.push(`出欠記録がある回のみを分母とした参加率: ${fmt(data.practice.recordedParticipationRate, "%")}`);
  lines.push("(見学は通常の出席と同等のトレーニング刺激としては扱わないでください)");
  lines.push(
    "(CIRCLE LINESは年度途中から利用開始されるチームがあり、運用開始以前の練習は出欠記録自体が存在しないことがあります。「年度内開催数ベースの参加率」は入団・運用開始時期を考慮しない参考値であり、これを実際の年間参加率と断定しないでください。出欠データカバー率が低い場合、低いのはCIRCLE LINES上の記録量であって、実際の参加状況ではない可能性があります。年間を通した参加傾向を評価してよいかはデータ品質の情報に従ってください)",
  );
  lines.push("");

  lines.push("■ 実施した練習メニュー(出席・遅刻早退した回のみ)");
  if (data.menus.length === 0) {
    lines.push("記録なし");
  } else {
    data.menus.forEach((m) =>
      lines.push(`${m.name}: 実施${m.implementedCount}回 / 開催${m.practicesHeld}回 / 実施率${fmt(m.implementationRate, "%")}`),
    );
    lines.push(
      "(「開催」はそのメニュー名がチーム全体の練習記録に登場した回数、「実施」はそのうち出席・遅刻早退していた回数です。1回あたりの実施時間・セット数・反復回数を示す値ではないため、実施率の高低だけで練習量の多寡を断定しないでください。出欠データカバー率が低い期間を含む場合、記録に表れていない練習・メニューが多く存在する可能性があるため、実施率の低さを「反復機会が不足している」等の現実の練習量の問題として断定しないでください)",
    );
  }
  lines.push("");

  lines.push("■ 身長・体重(時系列)");
  if (data.growth.length === 0) {
    lines.push("記録なし");
  } else {
    data.growth.forEach((g) => lines.push(`${g.date}: ${fmt(g.heightCm, "cm")} / ${fmt(g.weightKg, "kg")}`));
  }

  return lines.join("\n");
}

export function buildTeamActualData(data: TeamAnalysisData): string {
  const lines: string[] = [];
  lines.push("■ チーム情報");
  lines.push(`対象年度: ${fiscalYearLabel(data.fiscalYear)}`);
  lines.push(`在籍選手数: ${data.playerCount}名`);
  lines.push("");

  lines.push(...statsToLines(data.stats, "team", data.playerCount));
  lines.push("");

  if (data.sportsTest) {
    lines.push("■ スポーツテスト(時系列、チーム集計)");
    if (data.sportsTest.quarters.length === 0) {
      lines.push("記録なし");
    } else {
      lines.push(
        "(基準値・外部平均等の絶対評価基準は提供されていません。平均値・中央値の高低だけから「得意/苦手/平均以上/平均以下」等の絶対評価はせず、改善/維持/低下の人数(同一選手の時系列比較)を優先して解釈してください。評価方向なしの項目は「改善/低下」等の能力評価語を使わず、数値の変化のみを記述してください)",
      );
      lines.push(`[各項目の凡例] ${sportsTestLegend(data.sportsTest.quarters[0].metrics)}`);
      data.sportsTest.quarters.forEach((q) => {
        lines.push(`${q.fiscalYear}年度 Q${q.quarter}(測定 ${q.measuredPlayerCount}/${q.rosterCount}名):`);
        Object.values(q.metrics).forEach((m) => {
          const trend =
            m.improvedCount === null
              ? "前回データなし"
              : `改善${m.improvedCount}名/維持${m.maintainedCount}名/低下${m.declinedCount}名(前回も測定した選手のみ)`;
          lines.push(`  ${m.label}: 平均${fmt(m.average, m.unit)} / 中央値${fmt(m.median, m.unit)} / ${trend}`);
        });
      });
      lines.push("");
      lines.push("(チーム平均の比較よりも、上記の改善/維持/低下の同一選手比較を優先して解釈してください)");
    }
    lines.push("");
  }

  lines.push("■ 練習参加状況(チーム)");
  lines.push(`開催練習数: ${data.practice.practicesHeld}回 / 出欠記録がある練習: ${data.practice.attendanceRecordedSessionCount}回 / 出欠データカバー率: ${fmt(data.practice.attendanceCoverageRate, "%")}`);
  lines.push(`年度内開催数ベースの平均参加率(参考値): ${fmt(data.practice.fullYearAverageRate, "%")} / 中央値: ${fmt(data.practice.fullYearMedianRate, "%")}`);
  lines.push(`出欠記録がある選手のみの平均参加率: ${fmt(data.practice.recordedAverageRate, "%")} / 中央値: ${fmt(data.practice.recordedMedianRate, "%")}`);
  lines.push(`参加率80%以上: ${data.practice.highParticipantCount}名 / 参加率50%未満: ${data.practice.lowParticipantCount}名(出欠記録が1件もない選手は集計から除外)`);
  lines.push("(在籍選手数に対する人数です)");
  lines.push(
    "(CIRCLE LINESは年度途中から利用開始されるチームがあり、運用開始以前の練習は出欠記録自体が存在しないことがあります。「年度内開催数ベースの参加率」は運用開始時期を考慮しない参考値であり、実際の年間参加率と断定しないでください。出欠データカバー率が低い場合、チームとして「練習参加率が低い」と評価するのではなく、「CIRCLE LINES上の出欠データの蓄積がまだ少ないため、年間を通した参加傾向は現時点では評価できない」として扱ってください。データカバー率が低いことを理由に、練習参加率をチームの優先課題として採用しないでください)",
  );
  lines.push("");

  lines.push("■ 実施した練習メニュー(チーム全体)");
  if (data.menus.length === 0) {
    lines.push("記録なし");
  } else {
    data.menus.forEach((m) =>
      lines.push(`${m.name}: 実施${m.implementedCount}回 / 開催${m.practicesHeld}回 / 実施率${fmt(m.implementationRate, "%")}`),
    );
    lines.push(
      "(実施率は「年度内の開催練習のうち、そのメニュー名が記録された回の割合」です。1回あたりの実施時間・セット数・反復回数等の練習密度を示す値ではないため、実施率の高低だけで「反復機会が十分/不足している」等の練習量の断定はしないでください。出欠データカバー率が低い期間を含む場合、記録に表れていない練習・メニューが多く存在する可能性があります)",
    );
  }

  return lines.join("\n");
}
