"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { NewBadge, NumChip } from "@/components/ui/Pill";
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
  hasUnseenAnalysis,
}: {
  player: Player;
  noteCount: number;
  showNotes: boolean;
  selectable: boolean;
  hasUnseenNotes: boolean;
  // カルテ側のKartePlayerRowにあった「AI分析未読」バッジ。選手一覧・OB/OG一覧を
  // カルテと共通のRowにするため統合した(スタッフ以外は常にfalseで渡される想定)。
  hasUnseenAnalysis?: boolean;
}) {
  const router = useRouter();
  const { category } = useSession();
  const isObog = player.status === "OB・OG";
  const hasNotes = noteCount > 0;

  function navigate() {
    router.push(`/karte/players/${player.id}`);
  }

  return (
    <div
      onClick={selectable ? navigate : undefined}
      role={selectable ? "button" : undefined}
      tabIndex={selectable ? 0 : undefined}
      onKeyDown={
        selectable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigate();
              }
            }
          : undefined
      }
      className={`flex items-center gap-2.5 py-2.5 border-b border-line last:border-b-0 ${
        selectable ? "cursor-pointer" : "opacity-40"
      }`}
    >
      <NumChip num={player.number ?? "-"} muted={isObog} />
      <div className="flex-1 min-w-0">
        <div className="font-bold text-[13.5px] flex items-center gap-1.5">
          {hasUnseenAnalysis && <span className="w-[7px] h-[7px] rounded-full bg-danger flex-shrink-0" />}
          {playerFullName(player)}
        </div>
        <div className="text-[11px] text-ink-soft mt-0.5">
          {gradeLabel(player.grade, category)}・{player.positions.join("/")} · {player.status}
        </div>
      </div>
      {showNotes && (
        // メモ一覧(/players/[id]/notes)へ直接遷移させ、選手詳細を経由させない。
        <Link
          href={`/players/${player.id}/notes`}
          onClick={(e) => e.stopPropagation()}
          className="flex-shrink-0 flex items-center gap-1"
        >
          {hasUnseenNotes && <NewBadge />}
          <span
            className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-lg border whitespace-nowrap ${
              hasNotes ? "border-danger text-danger bg-danger/8" : "border-line text-ink-soft bg-white"
            }`}
          >
            {hasNotes ? "メモあり" : "メモなし"}
          </span>
        </Link>
      )}
      {selectable && <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />}
    </div>
  );
}
