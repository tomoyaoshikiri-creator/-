"use client";

import { Modal } from "@/components/ui/Modal";
import { LineupSection } from "./LineupSection";
import { OpponentLineupSection } from "./OpponentLineupSection";
import type { AttendanceStatus, GameOpponentPlayer, Player } from "@/lib/database.types";

// 2026-11 実機QA第1弾: 以前は両チームのスターティング編集を1つのモーダルに縦に
// まとめていたが、iPhoneで縦長になりすぎる不具合が実機確認で見つかったため、
// 既存の交代登録(MemberChangeModal、自チーム/相手チームを別々のモーダルで開く)と
// 同じ構成に合わせ、チームごとに独立したモーダルへ分離した。LineupSection・
// OpponentLineupSection自体の選手選択UI・保存ロジック(draft状態・登録ボタン)は
// 変更していない(スターティング登録と選手交代は別の処理のため、保存ロジックを
// 共通化しない)。
export function OwnStartingLineupModal({
  open,
  onClose,
  starters,
  savingStarters,
  players,
  attendanceStatus,
  onSaveStarters,
}: {
  open: boolean;
  onClose: () => void;
  starters: string[];
  savingStarters: boolean;
  players: Player[];
  attendanceStatus: Record<string, AttendanceStatus>;
  onSaveStarters: (starters: string[]) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="スターティング" maxWidthClass="max-w-[340px]">
      <LineupSection
        starters={starters}
        saving={savingStarters}
        players={players}
        attendanceStatus={attendanceStatus}
        onSaveStarters={onSaveStarters}
      />
    </Modal>
  );
}

export function OpponentStartingLineupModal({
  open,
  onClose,
  opponentPlayers,
  opponentStarters,
  savingOpponentStarters,
  onSaveOpponentStarters,
}: {
  open: boolean;
  onClose: () => void;
  opponentPlayers: GameOpponentPlayer[];
  opponentStarters: string[];
  savingOpponentStarters: boolean;
  onSaveOpponentStarters: (starters: string[]) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="スターティング(相手チーム)" maxWidthClass="max-w-[340px]">
      <OpponentLineupSection
        opponentPlayers={opponentPlayers}
        starters={opponentStarters}
        saving={savingOpponentStarters}
        onSaveStarters={onSaveOpponentStarters}
      />
    </Modal>
  );
}
