// クォーターごとのチームファウル数を丸いランプで表示する。ランプは4個までとし、
// ファウルが記録されるたびに透明(未点灯)のランプが1つずつ赤く点灯していく。
// 4個(=ボーナスフリースローが適用される5個目以降)に達すると4個とも点灯したままになり、
// 「そのクォーターのチームファウルが5個以上に達しているかどうか」がひと目で分かれば
// 十分なため、5個以降を個別の数値で数えるような表現(+Nなど)は持たせない。
const MAX_LAMPS = 4;

export function TeamFoulLamps({
  count,
  label,
  direction = "row",
}: {
  count: number;
  label?: string;
  // 縦画面のスコア表示では、両チームの得点の外側に縦一列で配置したいことがあるため、
  // ランプの並び方向を切り替えられるようにする(横画面はrowのみを使用)。
  direction?: "row" | "column";
}) {
  const lit = Math.min(count, MAX_LAMPS);
  const isColumn = direction === "column";
  return (
    <div
      className={`flex items-center ${isColumn ? "flex-col gap-1" : "gap-1"}`}
      aria-label={`${label ? `${label}の` : ""}チームファウル${count}個`}
    >
      {label && (
        <span className={`text-[9.5px] font-bold text-ink-soft ${isColumn ? "mb-0.5" : "mr-0.5"}`}>{label}</span>
      )}
      {Array.from({ length: MAX_LAMPS }, (_, i) => (
        <span
          key={i}
          className={`w-2.5 h-2.5 rounded-full border ${
            i < lit ? "bg-danger border-danger" : "border-line bg-transparent"
          }`}
        />
      ))}
    </div>
  );
}
