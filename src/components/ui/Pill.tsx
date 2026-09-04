import { scheduleTypeColor } from "@/lib/scheduleColor";

export function Pill({
  tone,
  children,
}: {
  tone: "ok" | "pending" | "absent" | "late" | "watch";
  children: React.ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "bg-green/10 text-green"
      : tone === "absent"
        ? "bg-danger/10 text-danger"
        : tone === "late"
          ? "bg-sky/10 text-sky"
          : tone === "watch"
            ? "bg-ink-soft/10 text-ink-soft"
            : "bg-orange/10 text-orange";
  return (
    <span className={`font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg ${cls}`}>
      {children}
    </span>
  );
}

export function TypeTag({
  type,
  gameCategory,
}: {
  type: "practice" | "game" | "event";
  gameCategory?: "練習試合" | "公式戦" | null;
}) {
  const color = scheduleTypeColor(type);
  const cls =
    color === "danger"
      ? "bg-danger/10 text-danger"
      : color === "sky"
        ? "bg-sky/10 text-sky"
        : "bg-orange/10 text-orange";
  const label = type === "game" ? (gameCategory ?? "試合") : type === "event" ? "イベント" : "練習";
  return (
    <span className={`font-mono text-[10.5px] font-bold px-2 py-0.5 rounded-lg mr-1.5 ${cls}`}>{label}</span>
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
