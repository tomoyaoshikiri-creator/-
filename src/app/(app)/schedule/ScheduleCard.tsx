import Link from "next/link";
import { Card } from "@/components/ui/Card";
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
  const pillTone = status === "出席" ? "ok" : "pending";
  const pillLabel = status ?? "未回答";

  return (
    <Link href={`/schedule/${schedule.id}`}>
      <Card className="cursor-pointer">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold text-[14.5px]">
              <TypeTag type={schedule.type} />
              {schedule.title}
            </div>
            <div className="text-xs text-ink-soft mt-0.5">{scheduleMeta(schedule)}</div>
            {schedule.toban && <div className="text-xs text-ink-soft mt-0.5">当番:{schedule.toban}</div>}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Pill tone={pillTone}>{pillLabel}</Pill>
            <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft" />
          </div>
        </div>
      </Card>
    </Link>
  );
}
