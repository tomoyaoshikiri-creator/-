// 外部チャートライブラリを使わず、既存のUIコンポーネント群と同じ方針(自前実装)で
// 折れ線グラフを描く。スポーツテストの推移表示に使う。
// 点数が多い(全年度表示など)場合は、点を圧縮せずグラフ自体を横に広げて
// 横スクロールで見られるようにする(minPointSpacingを下回らない間隔を保つ)。
export function LineTrendChart({
  points,
  formatValue = (v) => String(v),
  height = 140,
}: {
  points: { label: string; value: number | null }[];
  formatValue?: (v: number) => string;
  height?: number;
}) {
  const valid = points.filter((p): p is { label: string; value: number } => p.value !== null);

  if (valid.length === 0) {
    return <div className="text-[11.5px] text-ink-soft text-center py-6">表示できるデータがありません</div>;
  }

  const padL = 32;
  const padR = 10;
  const padTop = 10;
  const padBottom = 22;
  const minPointSpacing = 40;
  const fixedWidth = 260;
  const scrollable = valid.length > 6;
  const plotWidth = scrollable ? Math.max(1, valid.length - 1) * minPointSpacing : fixedWidth;
  const width = padL + plotWidth + padR;

  const rawValues = valid.map((p) => p.value);
  const rawMin = Math.min(...rawValues);
  const rawMax = Math.max(...rawValues);
  const rawRange = rawMax - rawMin || 1;
  // 目盛りが最大・最小値ぴったりに重ならないよう、少し余裕を持たせた範囲にする。
  const min = rawMin - rawRange * 0.15;
  const max = rawMax + rawRange * 0.15;
  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => min + ((max - min) * i) / tickCount);

  const plotH = height - padTop - padBottom;
  const yFor = (v: number) => padTop + (1 - (v - min) / (max - min)) * plotH;
  const xFor = (i: number) =>
    valid.length === 1 ? padL + plotWidth / 2 : padL + (i / (valid.length - 1)) * plotWidth;

  const coords = valid.map((p, i) => ({ x: xFor(i), y: yFor(p.value), value: p.value, label: p.label }));
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");

  return (
    <div>
      <div className={scrollable ? "overflow-x-auto" : ""}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ height, width: scrollable ? width : "100%" }}
        >
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={padL} y1={yFor(t)} x2={width - padR} y2={yFor(t)} stroke="var(--line)" strokeWidth="1" />
              <text x={padL - 5} y={yFor(t) + 3} fontSize="8.5" textAnchor="end" fill="var(--ink-soft)">
                {formatValue(t)}
              </text>
            </g>
          ))}
          <path d={path} fill="none" stroke="var(--orange)" strokeWidth="2" />
          {coords.map((c, i) => (
            <circle key={i} cx={c.x} cy={c.y} r="2.5" fill="var(--orange)" />
          ))}
          {coords.map((c, i) => (
            <text key={i} x={c.x} y={height - padBottom + 12} fontSize="8" textAnchor="middle" fill="var(--ink-soft)">
              {c.label}
            </text>
          ))}
        </svg>
      </div>
      <div className="text-[11px] text-ink-soft mt-1.5">
        直近値: <span className="font-bold text-ink">{formatValue(valid[valid.length - 1].value)}</span>
        <span className="mx-1.5">|</span>
        最小: {formatValue(rawMin)}
        <span className="mx-1.5">|</span>
        最大: {formatValue(rawMax)}
      </div>
    </div>
  );
}
