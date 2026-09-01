// クォーターごとのチームファウル数を丸いランプで表示する。バスケットボール・
// ミニバスケットボールいずれもチームファウルはペナルティ(ボーナスフリースロー)に
// 発展する最大の目安が5個であるため、5個分のランプを上限として用意し、
// ファウルが記録されるたびに透明(未点灯)のランプが1つずつ赤く点灯していく。
// (ペナルティ適用の具体的な個数はバスケットボール/ミニバスケットボールで異なりうるため、
// ここでは特定の個数を「ペナルティライン」として強調はせず、素直な点灯数の表示に留める)
const MAX_LAMPS = 5;

export function TeamFoulLamps({ count, label }: { count: number; label?: string }) {
  const overflow = count > MAX_LAMPS ? count - MAX_LAMPS : 0;
  return (
    <div className="flex items-center gap-1" aria-label={`${label ? `${label}の` : ""}チームファウル${count}個`}>
      {label && <span className="text-[9.5px] font-bold text-ink-soft mr-0.5">{label}</span>}
      {Array.from({ length: MAX_LAMPS }, (_, i) => (
        <span
          key={i}
          className={`w-2.5 h-2.5 rounded-full border ${
            i < count ? "bg-danger border-danger" : "border-line bg-transparent"
          }`}
        />
      ))}
      {overflow > 0 && <span className="text-[9.5px] font-bold text-danger ml-0.5">+{overflow}</span>}
    </div>
  );
}
