"use client";

import { useMemo, useState } from "react";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { TypeTag } from "@/components/ui/Pill";
import { scheduleMeta } from "@/lib/format";
import type { Schedule } from "@/lib/database.types";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function CalendarView({ schedules }: { schedules: Schedule[] }) {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    for (const s of schedules) {
      const list = map.get(s.date) ?? [];
      list.push(s);
      map.set(s.date, list);
    }
    return map;
  }, [schedules]);

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

  const dayEvents = selectedDate ? eventsByDate.get(selectedDate) ?? [] : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <button
          type="button"
          onClick={goPrev}
          className="w-[30px] h-[30px] rounded-lg bg-white border border-line flex items-center justify-center text-base text-navy"
        >
          ‹
        </button>
        <div className="font-display font-extrabold text-[17px] text-navy">
          {year}年{month + 1}月
        </div>
        <button
          type="button"
          onClick={goNext}
          className="w-[30px] h-[30px] rounded-lg bg-white border border-line flex items-center justify-center text-base text-navy"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-[10.5px] text-ink-soft font-bold mb-1">
        {["月", "火", "水", "木", "金", "土", "日"].map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c.date) return <div key={i} className="aspect-square" />;
          const events = eventsByDate.get(c.date) ?? [];
          const hasEvent = events.length > 0;
          const hasGame = events.some((e) => e.type === "game");
          const isSelected = selectedDate === c.date;
          return (
            <button
              key={c.date}
              type="button"
              onClick={() => setSelectedDate(c.date!)}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs border relative ${
                isSelected ? "outline outline-2 outline-navy" : ""
              } ${
                hasGame
                  ? "bg-orange/28 border-orange font-bold"
                  : hasEvent
                    ? "bg-orange/14 border-orange/35 font-bold"
                    : "bg-white border-line"
              }`}
            >
              {c.day}
              {hasEvent && <span className="w-1 h-1 rounded-full bg-orange mt-0.5" />}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <SectionLabel>選択した日の予定</SectionLabel>
        {!selectedDate ? (
          <EmptyState>日付をタップしてください</EmptyState>
        ) : dayEvents.length === 0 ? (
          <EmptyState>この日の予定はありません</EmptyState>
        ) : (
          dayEvents.map((ev) => (
            <Card key={ev.id}>
              <div className="font-bold text-[14.5px]">
                <TypeTag type={ev.type} />
                {ev.title}
              </div>
              <div className="text-xs text-ink-soft mt-0.5">{scheduleMeta(ev)}</div>
              {ev.toban && <div className="text-xs text-ink-soft mt-0.5">当番:{ev.toban}</div>}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
