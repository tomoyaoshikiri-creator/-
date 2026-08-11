import type { GamePlayerStatLine } from "@/lib/database.types";

export interface SeasonStatAverages {
  gp: number;
  pts: number;
  reb: number;
  rebOff: number;
  rebDef: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fouls: number;
  eff: number;
  fgPct: number | null;
  ftPct: number | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// 出場した試合(この選手のstat_lineが1行でも存在する試合)だけをGPとして数える。
export function computeSeasonAverages(lines: GamePlayerStatLine[]): SeasonStatAverages {
  const gp = lines.length;
  if (gp === 0) {
    return {
      gp: 0,
      pts: 0,
      reb: 0,
      rebOff: 0,
      rebDef: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      tov: 0,
      fouls: 0,
      eff: 0,
      fgPct: null,
      ftPct: null,
    };
  }
  const sum = lines.reduce(
    (acc, l) => ({
      pts: acc.pts + l.pts,
      reb: acc.reb + l.reb,
      rebOff: acc.rebOff + l.reb_off,
      rebDef: acc.rebDef + l.reb_def,
      ast: acc.ast + l.ast,
      stl: acc.stl + l.stl,
      blk: acc.blk + l.blk,
      tov: acc.tov + l.tov,
      fouls: acc.fouls + l.fouls,
      eff: acc.eff + l.eff,
      fgMade: acc.fgMade + l.fg_made,
      fgAtt: acc.fgAtt + l.fg_att,
      ftMade: acc.ftMade + l.ft_made,
      ftAtt: acc.ftAtt + l.ft_att,
    }),
    {
      pts: 0,
      reb: 0,
      rebOff: 0,
      rebDef: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      tov: 0,
      fouls: 0,
      eff: 0,
      fgMade: 0,
      fgAtt: 0,
      ftMade: 0,
      ftAtt: 0,
    },
  );
  return {
    gp,
    pts: round1(sum.pts / gp),
    reb: round1(sum.reb / gp),
    rebOff: round1(sum.rebOff / gp),
    rebDef: round1(sum.rebDef / gp),
    ast: round1(sum.ast / gp),
    stl: round1(sum.stl / gp),
    blk: round1(sum.blk / gp),
    tov: round1(sum.tov / gp),
    fouls: round1(sum.fouls / gp),
    eff: round1(sum.eff / gp),
    fgPct: sum.fgAtt > 0 ? round1((sum.fgMade / sum.fgAtt) * 100) : null,
    ftPct: sum.ftAtt > 0 ? round1((sum.ftMade / sum.ftAtt) * 100) : null,
  };
}

export type RankingMetric = "pts" | "reb" | "ast" | "stl" | "blk" | "eff" | "fgPct" | "ftPct";

export const RANKING_METRICS: { value: RankingMetric; label: string; unit: string }[] = [
  { value: "pts", label: "得点(PTS)", unit: "点" },
  { value: "reb", label: "リバウンド(REB)", unit: "本" },
  { value: "ast", label: "アシスト(AST)", unit: "本" },
  { value: "stl", label: "スティール(STL)", unit: "本" },
  { value: "blk", label: "ブロック(BLK)", unit: "本" },
  { value: "eff", label: "EFF", unit: "" },
  { value: "fgPct", label: "FG成功率", unit: "%" },
  { value: "ftPct", label: "FT成功率", unit: "%" },
];
