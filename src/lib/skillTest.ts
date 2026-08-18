// 検定(級・段制の技能検定)のランク一覧を生成する。級の数・段の数はチームが検定ごとに自由に設定できる。
// 並び順は0始まりで、級側(数字が大きいほど下位)→段側(数字が大きいほど上位)の順に昇順。
// 実際にDBへ保存されるlevel_labelはこの並びをサーバー側(skill_test_level_label関数)で再計算した値なので、
// ここでの生成ロジックはあくまで選択肢の表示用。
export function skillTestLevelLabels(kyuCount: number, danCount: number): string[] {
  const kyus = Array.from({ length: Math.max(0, kyuCount) }, (_, i) => `${kyuCount - i}級`);
  const dans = Array.from({ length: Math.max(0, danCount) }, (_, i) => (i === 0 ? "初段" : `${i + 1}段`));
  return [...kyus, ...dans];
}
