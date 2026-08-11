import { gameStatCellParts, type SeasonStatAverages } from "@/lib/karteAggregate";

// FG%/FT%は成功率の下に「成功数/試投数」を小さく併記する。それ以外の列は数値1行のみ。
export function StatCell({
  statKey,
  averages,
}: {
  statKey: keyof SeasonStatAverages;
  averages: SeasonStatAverages;
}) {
  const { primary, secondary } = gameStatCellParts(statKey, averages);
  if (!secondary) return <>{primary}</>;
  return (
    <div className="leading-tight">
      <div>{primary}</div>
      <div className="text-[9.5px] text-ink-soft font-normal">{secondary}</div>
    </div>
  );
}
