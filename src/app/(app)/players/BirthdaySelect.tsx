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
    const maxDay = daysInMonth(Number(y), Number(m));
    const dd = Math.min(Number(d), maxDay);
    return `${y}-${pad(Number(m))}-${pad(dd)}`;
  }

  // 年・月・日いずれか1つだけ選んだ時点で、他の未選択項目には仮の値(1月1日)を補って
  // 確定した日付を作る。3つ揃うまで反映を待つと、1つ選んだ瞬間に選択が消えて見えるため。
  function handleYearChange(y: string) {
    onChange(y ? compose(y, mStr || "1", dStr || "1") : "");
  }
  function handleMonthChange(m: string) {
    onChange(m ? compose(yStr || String(CURRENT_YEAR), m, dStr || "1") : "");
  }
  function handleDayChange(d: string) {
    onChange(d ? compose(yStr || String(CURRENT_YEAR), mStr || "1", d) : "");
  }

  return (
    <div className="flex gap-1.5">
      <select className={inputClass()} value={yStr} onChange={(e) => handleYearChange(e.target.value)}>
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
        onChange={(e) => handleMonthChange(e.target.value)}
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
        onChange={(e) => handleDayChange(e.target.value)}
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
