// 検定(級・段制の技能検定)のランク一覧を生成する。級の数・段の数はチームが検定ごとに自由に設定できる。
// 並び順は0始まりで、級側(数字が大きいほど下位)→段側(数字が大きいほど上位)の順に昇順。
// kyuLabel/danLabelで「級」「段」それぞれの呼び方を検定ごとに変更できる(既定は「級」「段」)。
export type SkillTestChapter = { name: string; kyu_count: number };

// chaptersが1件以上ある場合、段は番号(初段/2段…)ではなく「スタート編」「入門編」のような
// 名前付きチャプターのリストとして扱う。各チャプターは中の級の数(kyu_count)を個別に持ち、
// チャプター内は既存の級と同じ「数字が大きいほど下位」の向きで並ぶ
// (例: [{name:"スタート編",kyu_count:4},{name:"入門編",kyu_count:10}] なら
//  スタート編4級→…→スタート編1級→入門編10級→…→入門編1級)。
// chaptersが空の場合は、これまで通りdanCount/danKyuCountによる番号付きの段になる
// (danKyuCountが1以上なら 初段1級→初段2級→…→2段1級→… という段内の級を持つ)。
export function skillTestLevelLabels(
  kyuCount: number,
  danCount: number,
  levelNames?: Record<string, string> | null,
  danKyuCount: number = 0,
  kyuLabel: string = "級",
  danLabel: string = "段",
  chapters: SkillTestChapter[] = [],
): string[] {
  const kyus = Array.from({ length: Math.max(0, kyuCount) }, (_, i) => `${kyuCount - i}${kyuLabel}`);
  const dans =
    chapters.length > 0
      ? chapters.flatMap((chapter) =>
          Array.from({ length: Math.max(0, chapter.kyu_count) }, (_, i) => `${chapter.name}${chapter.kyu_count - i}${kyuLabel}`),
        )
      : (() => {
          const subCount = Math.max(danKyuCount, 1);
          return Array.from({ length: Math.max(0, danCount) * subCount }, (_, i) => {
            const danNumber = Math.floor(i / subCount) + 1;
            const danNumberLabel = danNumber === 1 ? `初${danLabel}` : `${danNumber}${danLabel}`;
            return danKyuCount > 0 ? `${danNumberLabel}${(i % subCount) + 1}${kyuLabel}` : danNumberLabel;
          });
        })();
  const defaults = [...kyus, ...dans];
  if (!levelNames) return defaults;
  return defaults.map((label, idx) => levelNames[String(idx)]?.trim() || label);
}

// level_indexが「段(チャプター)そのものへの昇格」(=新しい段/チャプターへの突入。承認フロー上
// ブロッキング扱い)か、「段内の級への昇格」(=同じ段/チャプターの中でのステップアップ。
// 承認フロー上は級扱い)かを判定する。
export function isSkillTestDanCrossing(
  kyuCount: number,
  danKyuCount: number,
  levelIndex: number,
  chapters: SkillTestChapter[] = [],
): boolean {
  if (levelIndex < kyuCount) return false;
  const offset = levelIndex - kyuCount;
  if (chapters.length > 0) {
    let cumulative = 0;
    for (const chapter of chapters) {
      if (offset === cumulative) return true;
      if (offset < cumulative + chapter.kyu_count) return false;
      cumulative += chapter.kyu_count;
    }
    return false;
  }
  const subCount = Math.max(danKyuCount, 1);
  return offset % subCount === 0;
}
