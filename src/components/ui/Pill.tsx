import { scheduleTypeColor } from "@/lib/scheduleColor";

export function Pill({
  tone,
  children,
  size = "sm",
}: {
  tone: "ok" | "pending" | "absent" | "late" | "watch";
  children: React.ReactNode;
  // 集計バッジ等の添え物(sm)に対し、「選択済みの状態そのもの」を主役として
  // 大きく見せたい場面(lg)で使う(出欠ステータスの表示など)。
  size?: "sm" | "lg";
}) {
  const cls =
    tone === "ok"
      ? "bg-green/10 text-green-text"
      : tone === "absent"
        ? "bg-danger/10 text-danger-text"
        : tone === "late"
          ? "bg-sky/10 text-sky"
          : tone === "watch"
            ? "bg-ink-soft/10 text-ink-soft"
            : "bg-orange/10 text-orange-text";
  const sizeCls = size === "lg" ? "text-[15px] px-3.5 py-2" : "text-[11px] px-2.5 py-1";
  return (
    <span className={`font-mono font-bold rounded-lg ${sizeCls} ${cls}`}>
      {children}
    </span>
  );
}

export function TypeTag({
  type,
  gameCategory,
}: {
  type: "practice" | "game" | "event" | "other";
  gameCategory?: "練習試合" | "公式戦" | null;
}) {
  const color = scheduleTypeColor(type);
  const cls =
    color === "danger"
      ? "bg-danger/10 text-danger-text"
      : color === "sky"
        ? "bg-sky/10 text-sky"
        : color === "ink-soft"
          ? "bg-ink-soft/10 text-ink-soft"
          : "bg-orange/10 text-orange-text";
  const label =
    type === "game" ? (gameCategory ?? "試合") : type === "event" ? "イベント" : type === "other" ? "その他" : "練習";
  return (
    <span className={`font-mono text-[10.5px] font-bold px-2 py-0.5 rounded-lg mr-1.5 ${cls}`}>{label}</span>
  );
}

// 一覧の中の個別項目(コメント・メモ等)が新着であることを示す小さなバッジ。
export function NewBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-lg bg-danger/10 text-danger-text ${className}`}>
      NEW
    </span>
  );
}

export function NumChip({ num, muted = false }: { num: string; muted?: boolean }) {
  return (
    <div
      className={`w-8 h-8 rounded-lg font-sans font-extrabold text-sm flex items-center justify-center flex-shrink-0 text-white ${
        muted ? "bg-ink-soft" : "bg-orange"
      }`}
    >
      {num}
    </div>
  );
}
