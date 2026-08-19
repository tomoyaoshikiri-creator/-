// Pro AI Plus/MaxのAI分析画面で「今月あと何回使えるか」を表示する。使用量表示のみで、
// 従量課金や追加購入の導線は持たない(仕様により月内は上限で打ち止め)。
// この回数は選手個人分析・チーム分析を合算した「チーム全体」の利用回数であり、
// 選手ごと・チームごとに別枠を持つわけではないため、その旨を小さく補足する。
export function AiUsageIndicator({ used, limit }: { used: number; limit: number }) {
  const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const atLimit = used >= limit;
  return (
    <div className="mt-2.5 mb-1">
      <div className="flex items-center justify-between text-[11px] text-ink-soft mb-1">
        <span>AI分析利用状況</span>
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
      <div className="text-[10.5px] text-ink-soft mt-1">チーム全体(選手分析・チーム分析の合計)で月{limit}回まで</div>
      {atLimit && (
        <div className="text-[11px] mt-1" style={{ color: "var(--danger)" }}>
          今月のAI分析利用上限(チーム全体で{limit}回)に達しました。翌月1日から再び利用できます。
        </div>
      )}
    </div>
  );
}
