"use client";

import { useState } from "react";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function MiniCalendarPicker({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (date: string) => void;
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // 月曜始まり
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: { date?: string; day?: number }[] = [];
  for (let i = 0; i < startOffset; i++) cells.push({});
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: `${year}-${pad(month + 1)}-${pad(day)}`, day });
  }

  function goPrev() {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }
  function goNext() {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={goPrev}
          className="w-[26px] h-[26px] rounded-lg bg-white border border-line flex items-center justify-center text-sm text-navy"
        >
          ‹
        </button>
        <div className="font-sans font-extrabold text-[13.5px] text-navy">
          {year}年{month + 1}月
        </div>
        <button
          type="button"
          onClick={goNext}
          className="w-[26px] h-[26px] rounded-lg bg-white border border-line flex items-center justify-center text-sm text-navy"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-[10px] text-ink-soft font-bold mb-1">
        {["月", "火", "水", "木", "金", "土", "日"].map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c.date) return <div key={i} className="aspect-square" />;
          const isSelected = selected.includes(c.date);
          return (
            <button
              key={c.date}
              type="button"
              onClick={() => onToggle(c.date!)}
              className={`aspect-square rounded-lg flex items-center justify-center text-[11px] border ${
                isSelected ? "bg-orange text-white border-orange font-bold" : "bg-white border-line text-ink"
              }`}
            >
              {c.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
