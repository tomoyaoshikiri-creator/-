"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import type { Attendance, Schedule } from "@/lib/database.types";

interface Row {
  userId: string;
  name: string;
  attendance: Attendance | null;
}

export function AttendanceRosterModal({
  schedule,
  open,
  onClose,
}: {
  schedule: Schedule;
  open: boolean;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const supabase = createClient();
      const [{ data: profiles }, { data: attendances }] = await Promise.all([
        supabase.from("profiles").select("id, name").order("name"),
        supabase.from("attendances").select("*").eq("schedule_id", schedule.id),
      ]);
      const attByUser = new Map((attendances ?? []).map((a) => [a.user_id, a]));
      setRows(
        (profiles ?? []).map((p) => ({
          userId: p.id,
          name: p.name,
          attendance: attByUser.get(p.id) ?? null,
        })),
      );
      setLoading(false);
    })();
  }, [open, schedule.id]);

  const isGame = schedule.type === "game";
  const attendingCount = rows.filter((r) => r.attendance?.status === "出席").length;
  const absentCount = rows.filter((r) => r.attendance?.status === "欠席").length;
  const noResponseCount = rows.length - attendingCount - absentCount;
  const totalAccompany = rows.reduce(
    (sum, r) => sum + (r.attendance?.accompany === "あり" ? (r.attendance.accompany_count ?? 0) : 0),
    0,
  );
  const carAvailableCount = rows.filter((r) => r.attendance?.car === "可").length;
  const totalSeats = rows.reduce(
    (sum, r) => sum + (r.attendance?.car === "可" ? (r.attendance.seats ?? 0) : 0),
    0,
  );

  return (
    <Modal open={open} onClose={onClose} title={`出欠一覧:${schedule.title}`}>
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg bg-green/10 text-green">
              出席 {attendingCount}
            </span>
            <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg bg-danger/10 text-danger">
              欠席 {absentCount}
            </span>
            <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg bg-orange/10 text-orange">
              未回答 {noResponseCount}
            </span>
          </div>

          {isGame && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg bg-navy/8 text-navy">
                帯同合計 {totalAccompany}名
              </span>
              <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg bg-navy/8 text-navy">
                車出し可 {carAvailableCount}名(乗車可能 合計{totalSeats}人)
              </span>
            </div>
          )}

          <div className="border border-line rounded-2xl overflow-hidden">
            {rows.length === 0 ? (
              <EmptyState>メンバーがいません</EmptyState>
            ) : (
              rows.map((r) => {
                const status = r.attendance?.status ?? null;
                return (
                  <div key={r.userId} className="px-3.5 py-2.5 border-b border-line last:border-b-0">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-[13px]">{r.name}</div>
                      <Pill tone={status === "出席" ? "ok" : "pending"}>{status ?? "未回答"}</Pill>
                    </div>
                    {isGame && r.attendance && (
                      <div className="text-[11px] text-ink-soft mt-1">
                        帯同:{" "}
                        {r.attendance.accompany === "あり"
                          ? `あり(${r.attendance.accompany_count ?? "-"}名)`
                          : r.attendance.accompany === "なし"
                            ? "なし"
                            : "未回答"}
                        {" ・ "}
                        車出し:{" "}
                        {r.attendance.car === "可"
                          ? `可(乗車${r.attendance.seats ?? "-"}人)`
                          : r.attendance.car === "不可"
                            ? "不可"
                            : "未回答"}
                        {r.attendance.note && ` ・ 備考:${r.attendance.note}`}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
