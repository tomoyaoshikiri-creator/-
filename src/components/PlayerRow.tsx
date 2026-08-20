"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { NumChip } from "@/components/ui/Pill";
import { ChevronRightIcon } from "@/components/icons";
import { gradeLabel, playerFullName } from "@/lib/format";
import { useSession } from "@/lib/session-context";
import type { Player } from "@/lib/database.types";

export function PlayerRow({
  player,
  noteCount,
  showNotes,
  selectable,
  hasUnseenNotes,
}: {
  player: Player;
  noteCount: number;
  showNotes: boolean;
  selectable: boolean;
  hasUnseenNotes: boolean;
}) {
  const router = useRouter();
  const { category } = useSession();
  const isObog = player.status === "OB・OG";
  const hasNotes = noteCount > 0;
  return (
    <div
      onClick={selectable ? () => router.push(`/players/${player.id}`) : undefined}
      className={`flex items-center gap-2.5 py-2.5 border-b border-line last:border-b-0 ${
        selectable ? "cursor-pointer" : "opacity-40"
      }`}
    >
      <NumChip num={player.number ?? "-"} muted={isObog} />
      <div className="flex-1 min-w-0 flex items-center gap-2.5">
        <div className="min-w-0">
          <div className="font-bold text-[13.5px]">{playerFullName(player)}</div>
          <div className="text-[11px] text-ink-soft mt-0.5">
            {gradeLabel(player.grade, category)}・{player.positions.join("/")} · {player.status}
          </div>
        </div>
        {showNotes && (
          <Link
            href={`/players/${player.id}/notes`}
            onClick={(e) => e.stopPropagation()}
            className={`relative flex-shrink-0 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md border whitespace-nowrap ${
              hasNotes ? "border-danger text-danger bg-danger/8" : "border-line text-ink bg-white"
            }`}
          >
            {hasNotes ? `メモあり(${noteCount}件)` : "メモなし"}
            {hasUnseenNotes && (
              <span className="absolute -top-1 -right-1 w-[7px] h-[7px] rounded-full bg-danger border border-white" />
            )}
          </Link>
        )}
      </div>
      {selectable && <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />}
    </div>
  );
}
