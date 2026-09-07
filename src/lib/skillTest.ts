// 検定(級・段制の技能検定)のランク一覧を生成する。級の数・段の数はチームが検定ごとに自由に設定できる。
// 並び順は0始まりで、級側(数字が大きいほど下位)→段側(数字が大きいほど上位)の順に昇順。
// danKyuCountが1以上の場合、各段の中にもさらに級(サブランク)を持たせる
// (例: danKyuCount=3なら 初段1級→初段2級→初段3級→2段1級→…)。0(既定)の場合は
// 従来通り段はサブランクなしの単一ランク(初段/2段/…)になる。
// levelNamesが渡された場合、該当level_indexに空でないカスタム名が設定されていればそちらを使う
// (未設定の場合の自動採番ラベルへのフォールバックは、DB側のset_skill_test_progress_label()と同じ方針)。
export function skillTestLevelLabels(
  kyuCount: number,
  danCount: number,
  levelNames?: Record<string, string> | null,
  danKyuCount: number = 0,
): string[] {
  const kyus = Array.from({ length: Math.max(0, kyuCount) }, (_, i) => `${kyuCount - i}級`);
  const subCount = Math.max(danKyuCount, 1);
  const dans = Array.from({ length: Math.max(0, danCount) * subCount }, (_, i) => {
    const danNumber = Math.floor(i / subCount) + 1;
    const danLabel = danNumber === 1 ? "初段" : `${danNumber}段`;
    return danKyuCount > 0 ? `${danLabel}${(i % subCount) + 1}級` : danLabel;
  });
  const defaults = [...kyus, ...dans];
  if (!levelNames) return defaults;
  return defaults.map((label, idx) => levelNames[String(idx)]?.trim() || label);
}

// level_indexが「段そのものへの昇格」(=新しい段への突入。承認フロー上ブロッキング扱い)か、
// 「段内の級への昇格」(=同じ段の中でのステップアップ。承認フロー上は級扱い)かを判定する。
// danKyuCount=0(段にサブランクがない検定)の場合は、段の範囲すべてが段そのものへの昇格になる
// (これまで通り、段の範囲はすべて要承認)。
export function isSkillTestDanCrossing(kyuCount: number, danKyuCount: number, levelIndex: number): boolean {
  if (levelIndex < kyuCount) return false;
  const subCount = Math.max(danKyuCount, 1);
  return (levelIndex - kyuCount) % subCount === 0;
}
