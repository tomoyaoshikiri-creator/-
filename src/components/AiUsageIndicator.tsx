// Pro AI Plus/MaxのAI分析画面で「今月あと何回使えるか」を表示する。使用量表示のみで、
// 従量課金や追加購入の導線は持たない(仕様により月内は上限で打ち止め)。
export function AiUsageIndicator({ used, limit }: { used: number; limit: number }) {
  const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const atLimit = used >= limit;
  return (
    <div className="mt-2.5 mb-1">
      <div className="flex items-center justify-between text-[11px] text-ink-soft mb-1">
        <span>今月のAI分析利用状況</span>
        <span className="font-bold text-ink">
          {used} / {limit}回
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-paper overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${percent}%`, background: atLimit ? "var(--danger)" : "var(--orange)" }}
        />
      </div>
      {atLimit && (
        <div className="text-[11px] mt-1" style={{ color: "var(--danger)" }}>
          今月のAI分析利用上限({limit}回)に達しました。翌月1日から再び利用できます。
        </div>
      )}
    </div>
  );
}
