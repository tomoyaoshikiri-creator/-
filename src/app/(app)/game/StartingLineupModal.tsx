"use client";

import { Modal } from "@/components/ui/Modal";
import { LineupSection } from "./LineupSection";
import { OpponentLineupSection } from "./OpponentLineupSection";
import type { AttendanceStatus, GameOpponentPlayer, Player } from "@/lib/database.types";

// 両チームのスターティング編集を1つのポップアップにまとめ、ページ最下部の
// 細いボタンからいつでも開けるようにする(常時表示のカードは置かない)。
export function StartingLineupModal({
  open,
  onClose,
  starters,
  savingStarters,
  players,
  attendanceStatus,
  onSaveStarters,
  opponentPlayers,
  opponentStarters,
  savingOpponentStarters,
  onSaveOpponentStarters,
}: {
  open: boolean;
  onClose: () => void;
  starters: string[];
  savingStarters: boolean;
  players: Player[];
  attendanceStatus: Record<string, AttendanceStatus>;
  onSaveStarters: (starters: string[]) => void;
  opponentPlayers: GameOpponentPlayer[];
  opponentStarters: string[];
  savingOpponentStarters: boolean;
  onSaveOpponentStarters: (starters: string[]) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="選手選択" maxWidthClass="max-w-[340px]">
      <LineupSection
        starters={starters}
        saving={savingStarters}
        players={players}
        attendanceStatus={attendanceStatus}
        onSaveStarters={onSaveStarters}
      />
      <OpponentLineupSection
        opponentPlayers={opponentPlayers}
        starters={opponentStarters}
        saving={savingOpponentStarters}
        onSaveStarters={onSaveOpponentStarters}
      />
    </Modal>
  );
}
