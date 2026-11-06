"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/Card";
import { MonthPicker } from "@/components/MonthPicker";
import { monthRangeBounds, scheduleMeta } from "@/lib/format";
import type { Schedule } from "@/lib/database.types";

// NEWS作成・編集画面から呼び出す、関連予定の選択専用モーダル(確定仕様4:
// 「予定選択は独立した画面で行う」)。一覧は年月で絞り込み、初期表示月は
// NEWSの表示対象年月に合わせる(呼び出し元から渡す)。予定は1件のみ選択可能、
// 「紐づけなし」も選べる。ここでの選択はNEWS側のstateを直接更新するだけで、
// DBへの保存は呼び出し元(NewNoticeModal/notice/[id]/page.tsx)の保存操作で
// まとめて行う(このモーダル自体はDBに書き込まない)。
export function SelectRelatedScheduleModal({
  open,
  onClose,
  initialMonth,
  selectedScheduleId,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  initialMonth: string;
  selectedScheduleId: string | null;
  onSelect: (schedule: Schedule | null) => void;
}) {
  const [monthValue, setMonthValue] = useState(initialMonth);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const supabase = createClient();
      const { start, end } = monthRangeBounds(monthValue);
      const { data } = await supabase
        .from("schedules")
        .select("*")
        .gte("date", start)
        .lt("date", end)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true, nullsFirst: false });
      setSchedules(data ?? []);
      setLoading(false);
    })();
  }, [open, monthValue]);

  return (
    <Modal open={open} onClose={onClose} title="関連予定を選択">
      <button
        type="button"
        onClick={() => {
          onSelect(null);
          onClose();
        }}
        className={`w-full min-h-tap flex items-center justify-center rounded-control border text-xs font-bold mb-3 ${
          selectedScheduleId === null ? "border-orange bg-orange/8 text-orange-text" : "border-line bg-paper text-ink-soft"
        }`}
      >
        紐づけなし
      </button>

      <MonthPicker value={monthValue} onChange={setMonthValue} />

      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : schedules.length === 0 ? (
        <EmptyState>この月の予定はありません</EmptyState>
      ) : (
        <div className="max-h-[50vh] overflow-y-auto -mx-1 px-1">
          {schedules.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onSelect(s);
                onClose();
              }}
              className={`w-full text-left min-h-tap px-3 py-2 rounded-control border mb-1.5 ${
                selectedScheduleId === s.id ? "border-orange bg-orange/8" : "border-line bg-white"
              }`}
            >
              <div className="font-bold text-[13.5px] truncate">{s.title}</div>
              <div className="text-[11.5px] text-ink-soft mt-0.5">{scheduleMeta(s)}</div>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
