import { fiscalYearLabel } from "@/lib/format";
import type { PlayerAnalysisData, StatsData, TeamAnalysisData } from "./types";

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

function aggregationTypeLabel(aggregationType: "SUM" | "AVERAGE" | "RATE" | "NEUTRAL" | null, scope: "player" | "team"): string {
  if (aggregationType === "SUM") return "集計方法: 合計値として見るべき項目";
  if (aggregationType === "AVERAGE") return "集計方法: 平均値として見るべき項目";
  if (aggregationType === "RATE") {
    return scope === "team"
      ? "集計方法: 割合・率(選手ごとの値の単純平均であり、チーム全体の分子/分母から算出した正確な合算率ではない可能性があります。参考値として扱ってください)"
      : "集計方法: 割合・率";
  }
  return "集計方法: 指定なし(この項目のチーム集計方法は定義されていません。合計・平均どちらの意味を持つ数値かを断定しないでください)";
}

function statsToLines(stats: StatsData, scope: "player" | "team"): string[] {
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
        lines.push(`  ${aggregationTypeLabel(c.aggregationType, scope)}`);
        lines.push(`  合計 ${c.seasonTotal} / 平均 ${c.seasonAverage}`);
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
    "(CLUB LINKは年度途中から利用開始されるチームがあり、運用開始以前の練習は出欠記録自体が存在しないことがあります。「年度内開催数ベースの参加率」は入団・運用開始時期を考慮しない参考値であり、これを実際の年間参加率と断定しないでください。出欠データカバー率が低い場合、低いのはCLUB LINK上の記録量であって、実際の参加状況ではない可能性があります。年間を通した参加傾向を評価してよいかはデータ品質の情報に従ってください)",
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

  lines.push(...statsToLines(data.stats, "team"));
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
    "(CLUB LINKは年度途中から利用開始されるチームがあり、運用開始以前の練習は出欠記録自体が存在しないことがあります。「年度内開催数ベースの参加率」は運用開始時期を考慮しない参考値であり、実際の年間参加率と断定しないでください。出欠データカバー率が低い場合、チームとして「練習参加率が低い」と評価するのではなく、「CLUB LINK上の出欠データの蓄積がまだ少ないため、年間を通した参加傾向は現時点では評価できない」として扱ってください。データカバー率が低いことを理由に、練習参加率をチームの優先課題として採用しないでください)",
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
