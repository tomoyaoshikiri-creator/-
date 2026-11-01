"use client";

import { useEffect, useMemo, useState } from "react";
import holiday_jp from "@holiday-jp/holiday_jp";
import { cardClass, EmptyState, SectionLabel } from "@/components/ui/Card";
import { todayDateStr } from "@/lib/format";
import { scheduleTypeColor } from "@/lib/scheduleColor";
import { ScheduleCard } from "./ScheduleCard";
import type { Attendance, Schedule } from "@/lib/database.types";

// UI刷新(作業1): カレンダー本体(月切替・曜日見出し・日付グリッド)を、ホーム画面等の
// 基準画面と同じ共通デザイントークン(bg-card/border-border-subtle/rounded-card/
// shadow-card、src/components/ui/Card.tsxのcardClassと同系)で包む。カレンダーは
// 単純なカードの並びではなく内部に独自グリッドを持つため、cardClassそのものではなく
// home/page.tsxのhomeCardClass等と同じ考え方でローカルに定義している(p-3の内側に
// 日付グリッド自体の枠線・角丸は別途残す)。
const calendarCardClass = "bg-card border border-border-subtle rounded-card shadow-card p-3 md:p-4 mb-4";

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
  sunday: "text-danger-text",
};

export interface Birthday {
  name: string;
  // "YYYY-MM-DD"。年は無視して月日だけを毎年の誕生日として扱う。
  birthday: string;
}

export function CalendarView({
  schedules,
  attendances = {},
  birthdays = [],
  onSelectDate,
}: {
  schedules: Schedule[];
  // 選択した日の予定カード(下記)をScheduleCard.tsxと共通化するために必要。
  // 予定一覧表示(page.tsxのlist表示)と同じ出欠データをそのまま渡すだけで、
  // 取得・集計ロジック自体はpage.tsx側のまま変更していない。
  attendances?: Record<string, Attendance>;
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
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // 前月末・翌月初の日付でマス目を埋め、週の途中で歯抜けにならないようにする。
  // 当月以外の日付もotherMonthフラグを立てつつ通常のセルと同じ扱い(選択・予定表示)にする。
  const cells: { date: string; day: number; otherMonth?: boolean }[] = [];
  for (let i = startOffset - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    cells.push({ date: `${prevYear}-${pad(prevMonth + 1)}-${pad(day)}`, day, otherMonth: true });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: `${year}-${pad(month + 1)}-${pad(day)}`, day });
  }
  const trailing = (7 - (cells.length % 7)) % 7;
  for (let day = 1; day <= trailing; day++) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    cells.push({ date: `${nextYear}-${pad(nextMonth + 1)}-${pad(day)}`, day, otherMonth: true });
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
      {/* UI刷新(作業1): 月切替・曜日見出し・日付グリッドをまとめて共通デザインの
          カード(calendarCardClass、上記)で包む。角丸・枠線・背景・余白を基準画面と
          揃える。月切替ボタンの見た目(rounded-lg、aspect-[4/3]セルの配色ルール等)は
          既存の共通デザインと同系(他画面の小型アイコンボタンも同じrounded-lg)のため
          変更していない。 */}
      <div className={calendarCardClass}>
        <div className="flex items-center justify-between mb-2.5">
          <button
            type="button"
            onClick={goPrev}
            className="w-[30px] h-[30px] rounded-lg bg-white border border-line flex items-center justify-center text-base text-heading"
          >
            ‹
          </button>
          <div className="font-sans font-extrabold text-[17px] text-heading">
            {year}年{month + 1}月
          </div>
          <button
            type="button"
            onClick={goNext}
            className="w-[30px] h-[30px] rounded-lg bg-white border border-line flex items-center justify-center text-base text-heading"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 text-center text-[10.5px] font-bold mb-1">
          {["月", "火", "水", "木", "金", "土", "日"].map((w, i) => (
            <div key={w} className={i === 5 ? "text-sky" : i === 6 ? "text-danger-text" : "text-ink-soft"}>
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 border border-line rounded-lg overflow-hidden divide-x divide-y divide-line">
        {cells.map((c, i) => {
          const events = eventsByDate.get(c.date) ?? [];
          const hasEvent = events.length > 0;
          const holiday = holidayKind(c.date, i % 7);
          const hasBirthday = birthdaysByMonthDay.has(c.date.slice(5, 10));
          // 同じ日に複数種別があれば 試合(danger) > イベント(sky) > 練習(orange) > その他(ink-soft) の優先度でマスの色を決める。
          const dayColors = new Set(events.map((e) => scheduleTypeColor(e.type)));
          const dayColor = dayColors.has("danger")
            ? "danger"
            : dayColors.has("sky")
              ? "sky"
              : dayColors.has("orange")
                ? "orange"
                : dayColors.has("ink-soft")
                  ? "ink-soft"
                  : null;
          const isSelected = selectedDate === c.date;
          const isToday = c.date === todayStr;
          // 月全体を1枚の四角として枠を持たせ、各マスは区切り線(divide)だけで分ける。
          // マスごとの個別の枠色は持たせず、背景色だけで選択中・予定ありを示す。
          const cellCls = isSelected
            ? "bg-navy/10 font-bold"
            : dayColor === "danger"
              ? "bg-danger/22 font-bold"
              : dayColor === "sky"
                ? "bg-sky/18 font-bold"
                : dayColor === "orange"
                  ? "bg-orange/18 font-bold"
                  : dayColor === "ink-soft"
                    ? "bg-ink-soft/18 font-bold"
                    : "bg-white";
          const dotCls =
            dayColor === "danger"
              ? "bg-danger"
              : dayColor === "sky"
                ? "bg-sky"
                : dayColor === "orange"
                  ? "bg-orange"
                  : dayColor === "ink-soft"
                    ? "bg-ink-soft"
                    : "";
          return (
            <button
              key={c.date}
              type="button"
              onClick={() => selectDate(c.date)}
              className={`aspect-[4/3] flex flex-col items-center justify-center text-xs relative ${
                !isSelected && isToday ? "outline outline-2 -outline-offset-2 outline-green" : ""
              } ${c.otherMonth ? "opacity-25" : ""} ${cellCls}`}
            >
              {hasBirthday && <span className="absolute top-0.5 right-0.5 text-[9px] leading-none">🎂</span>}
              <span className={holiday ? HOLIDAY_TEXT_CLASS[holiday] : ""}>{c.day}</span>
              {hasEvent && <span className={`w-1 h-1 rounded-full mt-0.5 ${dotCls}`} />}
            </button>
          );
        })}
        </div>
      </div>

      {/* UI刷新(作業1): 「選択した日の予定」は、カレンダー本体のカードとは別の
          セクションとして扱う(他の画面でも、SectionLabel+カード一覧はカレンダー
          本体のような単一ウィジェットのカードの外に置く構成のため)。誕生日表示は
          予定ではないためScheduleCardを再利用できず、共通cardClassのみ適用する。
          予定の表示は下のScheduleCard再利用(作業2)を参照。 */}
      <div className="mt-4">
        <SectionLabel>選択した日の予定</SectionLabel>
        {!selectedDate ? (
          <EmptyState>日付をタップしてください</EmptyState>
        ) : (
          <>
            {dayBirthdays.length > 0 && (
              <div className={cardClass}>
                <div className="font-bold text-[13px]">🎂 誕生日: {dayBirthdays.join("・")}</div>
              </div>
            )}
            {dayEvents.length === 0 ? (
              dayBirthdays.length === 0 && <EmptyState>この日の予定はありません</EmptyState>
            ) : (
              // UI刷新(作業2・3): 予定一覧表示(ScheduleCard.tsx)とカード・文字サイズ・
              // 表示情報(種別タグ・日時/場所・当番・出欠Pill)を完全に揃えるため、独自の
              // Card手書き実装ではなく同じScheduleCardをそのまま再利用する。遷移先・
              // 出欠表示ロジックはScheduleCard側に委譲しており、ここでは変更していない。
              dayEvents.map((ev) => <ScheduleCard key={ev.id} schedule={ev} attendance={attendances[ev.id]} />)
            )}
          </>
        )}
      </div>
    </div>
  );
}
