"use client";

import { inputClass } from "@/components/ui/SegButton";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
// 年を使わない(月日のみ)ため、2月はうるう年扱いの29日まで候補にする。
const DAYS_IN_MONTH: Record<number, number> = {
  1: 31, 2: 29, 3: 31, 4: 30, 5: 31, 6: 30, 7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31,
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// value: ""(未設定) または "MM-DD"
export function MonthDaySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [mStr, dStr] = value ? value.split("-") : ["", ""];
  const days = Array.from({ length: DAYS_IN_MONTH[Number(mStr)] ?? 31 }, (_, i) => i + 1);

  function compose(m: string, d: string): string {
    const maxDay = DAYS_IN_MONTH[Number(m)] ?? 31;
    return `${pad(Number(m))}-${pad(Math.min(Number(d), maxDay))}`;
  }
  // 月・日いずれか1つだけ選んだ時点で、もう一方には仮の値(1)を補って確定した値を作る
  // (1つ選んだ瞬間に選択が消えて見えないようにするため。BirthdaySelectと同じ考え方)。
  function handleMonthChange(m: string) {
    onChange(m ? compose(m, dStr || "1") : "");
  }
  function handleDayChange(d: string) {
    onChange(d ? compose(mStr || "1", d) : "");
  }

  return (
    <div className="flex gap-1.5">
      <select className={inputClass()} value={mStr ? String(Number(mStr)) : ""} onChange={(e) => handleMonthChange(e.target.value)}>
        <option value="">未設定</option>
        {MONTHS.map((m) => (
          <option key={m} value={m}>
            {m}月
          </option>
        ))}
      </select>
      <select className={inputClass()} value={dStr ? String(Number(dStr)) : ""} onChange={(e) => handleDayChange(e.target.value)}>
        <option value="">-</option>
        {days.map((d) => (
          <option key={d} value={d}>
            {d}日
          </option>
        ))}
      </select>
    </div>
  );
}
