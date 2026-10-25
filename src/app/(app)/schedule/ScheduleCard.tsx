import Link from "next/link";
import { cardClass } from "@/components/ui/Card";
import { Pill, TypeTag } from "@/components/ui/Pill";
import { ChevronRightIcon } from "@/components/icons";
import { scheduleMeta } from "@/lib/format";
import type { Attendance, Schedule } from "@/lib/database.types";

export function ScheduleCard({
  schedule,
  attendance,
}: {
  schedule: Schedule;
  attendance?: Attendance;
}) {
  const status = attendance?.status ?? null;
  const pillTone =
    status === "出席"
      ? "ok"
      : status === "欠席"
        ? "absent"
        : status === "遅刻早退"
          ? "late"
          : status === "見学"
            ? "watch"
            : "pending";
  const pillLabel = status ?? "未回答";

  return (
    <Link href={`/schedule/${schedule.id}`} className={`${cardClass} flex min-h-tap items-center justify-between gap-2`}>
      <div className="min-w-0">
        <div className="font-bold text-sm truncate">
          <TypeTag type={schedule.type} gameCategory={schedule.game_category} />
          {schedule.title}
        </div>
        <div className="text-caption text-ink-soft mt-0.5 truncate">{scheduleMeta(schedule)}</div>
        {schedule.toban && <div className="text-caption text-ink-soft mt-0.5 truncate">当番:{schedule.toban}</div>}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {schedule.requires_attendance && <Pill tone={pillTone}>{pillLabel}</Pill>}
        <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft" />
      </div>
    </Link>
  );
}
