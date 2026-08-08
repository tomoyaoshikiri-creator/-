export function Pill({ tone, children }: { tone: "ok" | "pending"; children: React.ReactNode }) {
  const cls =
    tone === "ok"
      ? "bg-green/10 text-green"
      : "bg-orange/10 text-orange";
  return (
    <span className={`font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg ${cls}`}>
      {children}
    </span>
  );
}

export function TypeTag({ type }: { type: "practice" | "game" | "event" }) {
  const cls =
    type === "game" ? "bg-orange/10 text-orange" : type === "event" ? "bg-green/10 text-green" : "bg-navy/8 text-navy";
  const label = type === "game" ? "試合" : type === "event" ? "イベント" : "練習";
  return (
    <span className={`font-mono text-[10.5px] font-bold px-2 py-0.5 rounded-md mr-1.5 ${cls}`}>{label}</span>
  );
}

export function NumChip({ num, muted = false }: { num: string; muted?: boolean }) {
  return (
    <div
      className={`w-8 h-8 rounded-[9px] font-sans font-extrabold text-sm flex items-center justify-center flex-shrink-0 text-white ${
        muted ? "bg-ink-soft" : "bg-orange"
      }`}
    >
      {num}
    </div>
  );
}
