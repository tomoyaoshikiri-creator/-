"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { NewBadge, NumChip } from "@/components/ui/Pill";
import { ChevronRightIcon } from "@/components/icons";
import { playerFullName } from "@/lib/format";
import type { Player } from "@/lib/database.types";

export function KartePlayerRow({
  player,
  hasUnseenAnalysis,
  selectable = true,
  // 選手メモは指導者・管理者専用の情報のため、showNotesはスタッフの時のみtrueで渡す想定
  // (PlayerRowと同じ方針)。
  showNotes = false,
  noteCount = 0,
  hasUnseenNotes = false,
}: {
  player: Player;
  hasUnseenAnalysis: boolean;
  // 保護者は自分に紐づく選手のみ選択可能(それ以外はPlayerRowと同様グレーアウト)。
  // スタッフは常にtrueのため、既存呼び出し元は変更不要。
  selectable?: boolean;
  showNotes?: boolean;
  noteCount?: number;
  hasUnseenNotes?: boolean;
}) {
  const router = useRouter();
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
      <NumChip num={player.number ?? "-"} />
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        {hasUnseenAnalysis && <span className="w-[7px] h-[7px] rounded-full bg-danger flex-shrink-0" />}
        <span className="font-bold text-[13.5px] truncate">{playerFullName(player)}</span>
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
