"use client";

import { inputClass } from "@/components/ui/SegButton";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

const CURRENT_YEAR = new Date().getFullYear();
// 少年スポーツチームの選手を想定し、直近25年分をカバーする(古い年度分の登録にも対応)。
const YEARS = Array.from({ length: 25 }, (_, i) => CURRENT_YEAR - i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

// value: ""(未設定) または "YYYY-MM-DD"
export function BirthdaySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [yStr, mStr, dStr] = value ? value.split("-") : ["", "", ""];

  function compose(y: string, m: string, d: string): string {
    if (!y || !m || !d) return "";
    const maxDay = daysInMonth(Number(y), Number(m));
    const dd = Math.min(Number(d), maxDay);
    return `${y}-${pad(Number(m))}-${pad(dd)}`;
  }

  return (
    <div className="flex gap-1.5">
      <select
        className={inputClass()}
        value={yStr}
        onChange={(e) => onChange(compose(e.target.value, mStr, dStr))}
      >
        <option value="">未設定</option>
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y}年
          </option>
        ))}
      </select>
      <select
        className={inputClass()}
        value={mStr ? String(Number(mStr)) : ""}
        onChange={(e) => onChange(compose(yStr, e.target.value, dStr))}
      >
        <option value="">-</option>
        {MONTHS.map((m) => (
          <option key={m} value={m}>
            {m}月
          </option>
        ))}
      </select>
      <select
        className={inputClass()}
        value={dStr ? String(Number(dStr)) : ""}
        onChange={(e) => onChange(compose(yStr, mStr, e.target.value))}
      >
        <option value="">-</option>
        {DAYS.map((d) => (
          <option key={d} value={d}>
            {d}日
          </option>
        ))}
      </select>
    </div>
  );
}
