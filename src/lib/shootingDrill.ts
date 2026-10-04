// シュート練習記録(コービーシューティング)の純粋な計算ロジック。
// 3P→ミドル→ゴール下の順で繰り返し、1本ごとの成否(shots)の並びから、種類ごとの
// 成功/本数・総得点・目標点への到達判定を導く。UIのタイマー計測画面・手入力フォーム
// どちらからも使う。

export type ShotCategory = "three" | "mid" | "layup";

const SHOT_CATEGORY_SEQUENCE: ShotCategory[] = ["three", "mid", "layup"];

const POINTS_BY_CATEGORY: Record<ShotCategory, number> = {
  three: 3,
  mid: 2,
  layup: 1,
};

export const SHOOTING_DRILL_TARGET_OPTIONS = [11, 15, 21] as const;
export type ShootingDrillTarget = (typeof SHOOTING_DRILL_TARGET_OPTIONS)[number];

// shots配列中のindex(0始まり)が、3P→ミドル→ゴール下のうちどれに当たるか。
// 外しても次のindexへ進む(打ち直さない)ため、成否に関わらずindexだけで決まる。
export function shotCategoryForIndex(index: number): ShotCategory {
  return SHOT_CATEGORY_SEQUENCE[index % SHOT_CATEGORY_SEQUENCE.length];
}

// 次に打つシュートの種類(まだ0本も打っていなければ3Pから)。
export function nextShotCategory(shots: boolean[]): ShotCategory {
  return shotCategoryForIndex(shots.length);
}

export interface ShootingDrillCounts {
  three_made: number;
  three_att: number;
  mid_made: number;
  mid_att: number;
  layup_made: number;
  layup_att: number;
}

export interface ShootingDrillSummary extends ShootingDrillCounts {
  total_points: number;
}

// 種類ごとの成功本数からの総得点算出。DB側のtotal_points(generated column、
// three_made*3 + mid_made*2 + layup_made)と必ず同じ式にすること。
export function totalPointsFromCounts(counts: Pick<ShootingDrillCounts, "three_made" | "mid_made" | "layup_made">): number {
  return counts.three_made * 3 + counts.mid_made * 2 + counts.layup_made;
}

// 1本ごとの成否の並び(shots)から、種類ごとの成功/本数・総得点を集計する。
export function summarizeShots(shots: boolean[]): ShootingDrillSummary {
  const counts: ShootingDrillCounts = {
    three_made: 0,
    three_att: 0,
    mid_made: 0,
    mid_att: 0,
    layup_made: 0,
    layup_att: 0,
  };
  shots.forEach((made, i) => {
    const category = shotCategoryForIndex(i);
    if (category === "three") {
      counts.three_att += 1;
      if (made) counts.three_made += 1;
    } else if (category === "mid") {
      counts.mid_att += 1;
      if (made) counts.mid_made += 1;
    } else {
      counts.layup_att += 1;
      if (made) counts.layup_made += 1;
    }
  });
  return { ...counts, total_points: totalPointsFromCounts(counts) };
}

// 合計が目標点に到達した時点で終了(目標点ちょうどでなくてよい)。
export function isDrillComplete(shots: boolean[], targetPoints: number): boolean {
  return summarizeShots(shots).total_points >= targetPoints;
}

export function pointsForCategory(category: ShotCategory): number {
  return POINTS_BY_CATEGORY[category];
}
