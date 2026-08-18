import { fiscalYearLabel } from "@/lib/format";
import type { PlayerAnalysisData, StatsData, TeamAnalysisData } from "./types";

function fmt(v: number | null | undefined, unit = ""): string {
  return v === null || v === undefined ? "データなし" : `${v}${unit}`;
}

function statsToLines(stats: StatsData): string[] {
  const lines: string[] = [];
  if (stats.kind === "basketball") {
    lines.push(`■ 試合スタッツ(シーズン平均、試合数: ${stats.gameCount})`);
    if (stats.gameCount === 0) {
      lines.push("この年度の出場記録はありません");
    } else {
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
        lines.push(`${c.name}(${directionLabel}${meta ? `, ${meta}` : ""}): 合計 ${c.seasonTotal} / 平均 ${c.seasonAverage}`);
      });
      if (stats.games.length > 0) {
        lines.push("");
        lines.push("■ 試合ごとの記録");
        stats.games.forEach((g) => {
          const summary = Object.entries(g.values)
            .map(([k, v]) => `${k} ${v}`)
            .join(" / ");
          lines.push(`${g.label}: ${summary}`);
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

  lines.push(...statsToLines(data.stats));
  lines.push("");

  if (data.sportsTest) {
    lines.push("■ スポーツテスト(時系列)");
    if (data.sportsTest.quarters.length === 0) {
      lines.push("記録なし");
    } else {
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
  lines.push(`開催練習数: ${data.practice.practicesHeld}回`);
  lines.push(`出席: ${data.practice.attended}回 / 遅刻早退: ${data.practice.late}回 / 見学: ${data.practice.observed}回 / 欠席: ${data.practice.absent}回`);
  lines.push(`参加率(出席+遅刻早退/開催数): ${fmt(data.practice.participationRate, "%")}`);
  lines.push("(見学は通常の出席と同等のトレーニング刺激としては扱わないでください)");
  lines.push("");

  lines.push("■ 実施した練習メニュー(出席・遅刻早退した回のみ)");
  if (data.menus.length === 0) {
    lines.push("記録なし");
  } else {
    data.menus.forEach((m) =>
      lines.push(`${m.name}: 実施${m.implementedCount}回 / 開催${m.practicesHeld}回 / 実施率${fmt(m.implementationRate, "%")}`),
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

  lines.push(...statsToLines(data.stats));
  lines.push("");

  if (data.sportsTest) {
    lines.push("■ スポーツテスト(時系列、チーム集計)");
    if (data.sportsTest.quarters.length === 0) {
      lines.push("記録なし");
    } else {
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
  lines.push(`開催練習数: ${data.practice.practicesHeld}回`);
  lines.push(`平均参加率: ${fmt(data.practice.averageRate, "%")} / 中央値: ${fmt(data.practice.medianRate, "%")}`);
  lines.push(`参加率80%以上: ${data.practice.highParticipantCount}名 / 参加率50%未満: ${data.practice.lowParticipantCount}名`);
  lines.push("(在籍選手数に対する人数です)");
  lines.push("");

  lines.push("■ 実施した練習メニュー(チーム全体)");
  if (data.menus.length === 0) {
    lines.push("記録なし");
  } else {
    data.menus.forEach((m) =>
      lines.push(`${m.name}: 実施${m.implementedCount}回 / 開催${m.practicesHeld}回 / 実施率${fmt(m.implementationRate, "%")}`),
    );
  }

  return lines.join("\n");
}
