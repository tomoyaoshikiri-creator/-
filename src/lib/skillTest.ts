// 検定(級・段制の技能検定)のランク一覧を生成する。級の数・段の数はチームが検定ごとに自由に設定できる。
// 並び順は0始まりで、級側(数字が大きいほど下位)→段側(数字が大きいほど上位)の順に昇順。
// levelNamesが渡された場合、該当level_indexに空でないカスタム名が設定されていればそちらを使う
// (未設定の場合の自動採番ラベルへのフォールバックは、DB側のset_skill_test_progress_label()と同じ方針)。
export function skillTestLevelLabels(
  kyuCount: number,
  danCount: number,
  levelNames?: Record<string, string> | null,
): string[] {
  const kyus = Array.from({ length: Math.max(0, kyuCount) }, (_, i) => `${kyuCount - i}級`);
  const dans = Array.from({ length: Math.max(0, danCount) }, (_, i) => (i === 0 ? "初段" : `${i + 1}段`));
  const defaults = [...kyus, ...dans];
  if (!levelNames) return defaults;
  return defaults.map((label, idx) => levelNames[String(idx)]?.trim() || label);
}
