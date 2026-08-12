"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import holiday_jp from "@holiday-jp/holiday_jp";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { TypeTag } from "@/components/ui/Pill";
import { scheduleMeta, todayDateStr } from "@/lib/format";
import { scheduleTypeColor } from "@/lib/scheduleColor";
import type { Schedule } from "@/lib/database.types";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// 月曜始まりの曜日インデックス(0=月...5=土, 6=日)を基準に、日付文字列の休日区分を判定する。
function holidayKind(dateStr: string, weekdayIndex: number): "holiday" | "saturday" | "sunday" | null {
  if (holiday_jp.isHoliday(new Date(dateStr + "T00:00:00"))) return "holiday";
  if (weekdayIndex === 6) return "sunday";
  if (weekdayIndex === 5) return "saturday";
  return null;
}

const HOLIDAY_TEXT_CLASS: Record<"holiday" | "saturday" | "sunday", string> = {
  holiday: "text-holiday",
  saturday: "text-sky",
  sunday: "text-danger",
};

export interface Birthday {
  name: string;
  // "YYYY-MM-DD"。年は無視して月日だけを毎年の誕生日として扱う。
  birthday: string;
}

export function CalendarView({
  schedules,
  birthdays = [],
  onSelectDate,
}: {
  schedules: Schedule[];
  birthdays?: Birthday[];
  // 選択中の日付が変わるたびに呼ばれる。「予定を追加」で選択日を初期値として渡すのに使う。
  onSelectDate?: (date: string | null) => void;
}) {
  const now = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => todayDateStr(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(todayStr);

  // 初期表示は当日の予定を選択済みの状態にしておく。
  useEffect(() => {
    onSelectDate?.(todayStr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 選択中の日付を再タップしたら選択解除する。
  function selectDate(date: string) {
    const next = selectedDate === date ? null : date;
    setSelectedDate(next);
    onSelectDate?.(next);
  }

  const eventsByDate = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    for (const s of schedules) {
      const list = map.get(s.date) ?? [];
      list.push(s);
      map.set(s.date, list);
    }
    return map;
  }, [schedules]);

  // 月日(MM-DD)をキーに、毎年その日を誕生日とする選手名の一覧をまとめる。
  const birthdaysByMonthDay = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const b of birthdays) {
      const key = b.birthday.slice(5, 10);
      const list = map.get(key) ?? [];
      list.push(b.name);
      map.set(key, list);
    }
    return map;
  }, [birthdays]);

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
  const dayBirthdays = selectedDate ? birthdaysByMonthDay.get(selectedDate.slice(5, 10)) ?? [] : [];

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
        <div className="font-sans font-extrabold text-[17px] text-navy">
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

      <div className="grid grid-cols-7 text-center text-[10.5px] font-bold mb-1">
        {["月", "火", "水", "木", "金", "土", "日"].map((w, i) => (
          <div key={w} className={i === 5 ? "text-sky" : i === 6 ? "text-danger" : "text-ink-soft"}>
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c.date) return <div key={i} className="aspect-[4/3]" />;
          const events = eventsByDate.get(c.date) ?? [];
          const hasEvent = events.length > 0;
          const holiday = holidayKind(c.date, i % 7);
          const hasBirthday = birthdaysByMonthDay.has(c.date.slice(5, 10));
          // 同じ日に複数種別があれば 試合(danger) > イベント(sky) > 練習(orange) の優先度でマスの色を決める。
          const dayColors = new Set(events.map((e) => scheduleTypeColor(e.type)));
          const dayColor = dayColors.has("danger")
            ? "danger"
            : dayColors.has("sky")
              ? "sky"
              : dayColors.has("orange")
                ? "orange"
                : null;
          const isSelected = selectedDate === c.date;
          const isToday = c.date === todayStr;
          const isColored = isSelected || dayColor !== null;
          const cellCls = isSelected
            ? "bg-navy/10 border-navy font-bold"
            : dayColor === "danger"
              ? "bg-danger/22 border-danger font-bold"
              : dayColor === "sky"
                ? "bg-sky/18 border-sky font-bold"
                : dayColor === "orange"
                  ? "bg-orange/18 border-orange font-bold"
                  : "bg-white border-line";
          const dotCls =
            dayColor === "danger" ? "bg-danger" : dayColor === "sky" ? "bg-sky" : dayColor === "orange" ? "bg-orange" : "";
          return (
            <button
              key={c.date}
              type="button"
              onClick={() => selectDate(c.date!)}
              className={`aspect-[4/3] rounded-lg flex flex-col items-center justify-center text-xs relative ${
                isColored ? "border-2" : "border"
              } ${!isSelected && isToday ? "outline outline-2 outline-green" : ""} ${cellCls}`}
            >
              {hasBirthday && <span className="absolute top-0.5 right-0.5 text-[9px] leading-none">🎂</span>}
              <span className={holiday ? HOLIDAY_TEXT_CLASS[holiday] : ""}>{c.day}</span>
              {hasEvent && <span className={`w-1 h-1 rounded-full mt-0.5 ${dotCls}`} />}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <SectionLabel>選択した日の予定</SectionLabel>
        {!selectedDate ? (
          <EmptyState>日付をタップしてください</EmptyState>
        ) : (
          <>
            {dayBirthdays.length > 0 && (
              <Card>
                <div className="font-bold text-[13px]">🎂 誕生日: {dayBirthdays.join("・")}</div>
              </Card>
            )}
            {dayEvents.length === 0 ? (
              dayBirthdays.length === 0 && <EmptyState>この日の予定はありません</EmptyState>
            ) : (
              dayEvents.map((ev) => (
                <Link key={ev.id} href={`/schedule/${ev.id}`}>
                  <Card className="cursor-pointer">
                    <div className="font-bold text-[14.5px]">
                      <TypeTag type={ev.type} gameCategory={ev.game_category} />
                      {ev.title}
                    </div>
                    <div className="text-xs text-ink-soft mt-0.5">{scheduleMeta(ev)}</div>
                    {ev.toban && <div className="text-xs text-ink-soft mt-0.5">当番:{ev.toban}</div>}
                  </Card>
                </Link>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
