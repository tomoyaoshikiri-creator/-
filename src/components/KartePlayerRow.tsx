"use client";

import Link from "next/link";
import { NumChip } from "@/components/ui/Pill";
import { ChevronRightIcon } from "@/components/icons";
import { playerFullName } from "@/lib/format";
import type { Player } from "@/lib/database.types";

export function KartePlayerRow({ player, hasUnseenAnalysis }: { player: Player; hasUnseenAnalysis: boolean }) {
  return (
    <Link
      href={`/karte/players/${player.id}`}
      className="flex items-center gap-2.5 py-2.5 border-b border-line last:border-b-0"
    >
      <NumChip num={player.number ?? "-"} />
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        {hasUnseenAnalysis && <span className="w-[7px] h-[7px] rounded-full bg-danger flex-shrink-0" />}
        <span className="font-bold text-[13.5px]">{playerFullName(player)}</span>
      </div>
      <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
    </Link>
  );
}
