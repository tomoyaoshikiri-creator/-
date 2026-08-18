// 外部チャートライブラリを使わず、既存のUIコンポーネント群と同じ方針(自前実装)で
// 折れ線グラフを描く。スタッツ成長推移(Pro以上)の「試合ごとの推移」表示に使う。
export function LineTrendChart({
  points,
  formatValue = (v) => String(v),
  height = 120,
}: {
  points: { label: string; value: number | null }[];
  formatValue?: (v: number) => string;
  height?: number;
}) {
  const valid = points.filter((p): p is { label: string; value: number } => p.value !== null);

  if (valid.length === 0) {
    return <div className="text-[11.5px] text-ink-soft text-center py-6">表示できるデータがありません</div>;
  }

  const width = 300;
  const padX = 8;
  const padY = 14;
  const values = valid.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const coords = valid.map((p, i) => {
    const x = valid.length === 1 ? width / 2 : padX + (i / (valid.length - 1)) * (width - padX * 2);
    const y = padY + (1 - (p.value - min) / range) * (height - padY * 2);
    return { x, y, value: p.value };
  });

  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
        <path d={path} fill="none" stroke="var(--orange)" strokeWidth="2" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="2.5" fill="var(--orange)" />
        ))}
      </svg>
      <div className="flex items-center justify-between text-[10px] text-ink-soft mt-0.5">
        <span>{valid[0].label}</span>
        <span>{valid[valid.length - 1].label}</span>
      </div>
      <div className="text-[11px] text-ink-soft mt-1.5">
        直近値: <span className="font-bold text-ink">{formatValue(valid[valid.length - 1].value)}</span>
        <span className="mx-1.5">|</span>
        最小: {formatValue(min)}
        <span className="mx-1.5">|</span>
        最大: {formatValue(max)}
      </div>
    </div>
  );
}
