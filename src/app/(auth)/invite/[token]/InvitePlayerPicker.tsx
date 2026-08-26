"use client";

import { FieldLabel, inputClass } from "@/components/ui/SegButton";
import { gradeLabel, playerFullName, sortPlayers } from "@/lib/format";
import type { Player, TeamCategory } from "@/lib/database.types";

export type InvitePlayer = Pick<Player, "id" | "sei" | "mei" | "grade" | "number">;

// InviteForm(新規登録)・AcceptInviteAsExistingUserForm(ログイン済みユーザー)の
// 両方で使う、招待受諾時の「お子さんを選ぶ」UI。role='一般'の招待でのみ表示する。
export function InvitePlayerPicker({
  players,
  category,
  selectedIds,
  onChange,
}: {
  players: InvitePlayer[];
  category: TeamCategory;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const sortedPlayers = sortPlayers(players as (InvitePlayer & { grade: string | null; number: string | null })[]);

  if (sortedPlayers.length === 0) return null;

  function setSelection(index: number, value: string) {
    onChange(selectedIds.map((id, i) => (i === index ? value : id)));
  }

  function addRow() {
    onChange([...selectedIds, ""]);
  }

  function removeRow(index: number) {
    onChange(selectedIds.filter((_, i) => i !== index));
  }

  return (
    <div className="mt-3">
      <FieldLabel>お子さん(あとから設定することもできます)</FieldLabel>
      {selectedIds.map((selectedId, index) => {
        const otherIds = selectedIds.filter((_, i) => i !== index);
        const options = sortedPlayers.filter((p) => !otherIds.includes(p.id));
        return (
          <div key={index} className="flex gap-2 mt-2 first:mt-0">
            <select
              name="playerId"
              className={inputClass("flex-1")}
              value={selectedId}
              onChange={(e) => setSelection(index, e.target.value)}
            >
              <option value="">選択してください</option>
              {options.map((p) => (
                <option key={p.id} value={p.id}>
                  {playerFullName(p)}({gradeLabel(p.grade, category)})
                </option>
              ))}
            </select>
            {selectedIds.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(index)}
                className="flex-shrink-0 px-3 rounded-[10px] text-[12.5px] font-bold border border-line bg-paper text-ink-soft"
              >
                削除
              </button>
            )}
          </div>
        );
      })}
      {selectedIds.length < sortedPlayers.length && (
        <button type="button" onClick={addRow} className="mt-2 text-[12px] font-bold text-orange">
          + もう一人追加
        </button>
      )}
    </div>
  );
}
