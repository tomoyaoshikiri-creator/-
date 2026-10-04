// シェービングドリルの固定定義。前前・前後・後前・後後の4種目を、決まった時間内に
// 何回できたかを記録する。コービーシューティングと違い、タイマー計測ではなく
// 結果(回数)だけを入力する運用のため、ここには表示用の定数のみを持つ。

export const SHAVING_MOVE_LABELS = ["前前", "前後", "後前", "後後"] as const;

// プリセット(秒)。任意の秒数も別途入力できる。
export const SHAVING_DURATION_PRESETS = [180, 300] as const;

export function formatShavingDuration(sec: number): string {
  if (sec % 60 === 0) return `${sec / 60}分`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}分${s}秒` : `${s}秒`;
}
