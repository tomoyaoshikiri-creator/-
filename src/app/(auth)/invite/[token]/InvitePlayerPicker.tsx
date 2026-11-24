"use client";

import { useState } from "react";
import { FieldLabel, inputClass } from "@/components/ui/SegButton";
import { gradeLabel, playerFullName, sortPlayers } from "@/lib/format";
import type { Player, TeamCategory } from "@/lib/database.types";

export type InvitePlayer = Pick<Player, "id" | "sei" | "mei" | "grade" | "number" | "status">;

// InviteForm(新規登録)・AcceptInviteAsExistingUserForm(ログイン済みユーザー)の
// 両方で使う、招待受諾時の「紐付ける選手を選ぶ」UI。role='一般'の招待でのみ表示する。
// 在籍選手に加えてOB・OG(卒業済み)選手も選べる(進級後に選手本人が自分のアカウントを
// 作る場合、進級時点で既にOB・OGになっている自分を選べるようにするため)。選手一覧が
// 無駄に長くならないよう、OB・OGは「OB・OG」ボタンをタップした時だけ候補に出す。
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
  const [showObog, setShowObog] = useState(false);
  const sortedPlayers = sortPlayers(players as (InvitePlayer & { grade: string | null; number: string | null })[]);
  const activePlayers = sortedPlayers.filter((p) => p.status !== "OB・OG");
  const obogPlayers = sortedPlayers.filter((p) => p.status === "OB・OG");
  const visiblePlayers = showObog ? sortedPlayers : activePlayers;

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
      <FieldLabel>本アカウントに紐づける選手を選択してください。</FieldLabel>
      <div className="text-[11px] text-ink-soft mb-1.5 -mt-1">あとから設定を変更することもできます。</div>
      {selectedIds.map((selectedId, index) => {
        const otherIds = selectedIds.filter((_, i) => i !== index);
        const activeOptions = activePlayers.filter((p) => !otherIds.includes(p.id));
        const obogOptions = obogPlayers.filter((p) => !otherIds.includes(p.id));
        return (
          <div key={index} className="flex gap-2 mt-2 first:mt-0">
            <select
              name="playerId"
              className={inputClass("flex-1")}
              value={selectedId}
              onChange={(e) => setSelection(index, e.target.value)}
            >
              <option value="">選択してください</option>
              {activeOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {playerFullName(p)}({gradeLabel(p.grade, category)})
                </option>
              ))}
              {showObog && obogOptions.length > 0 && (
                <optgroup label="OB・OG">
                  {obogOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {playerFullName(p)}(OB・OG)
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {selectedIds.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(index)}
                className="flex-shrink-0 px-3 rounded-lg text-[12.5px] font-bold border border-line bg-paper text-ink-soft"
              >
                削除
              </button>
            )}
          </div>
        );
      })}
      {selectedIds.length < visiblePlayers.length && (
        <button type="button" onClick={addRow} className="mt-2 text-[12px] font-bold text-orange-text">
          + もう一人追加
        </button>
      )}
      {obogPlayers.length > 0 && (
        <button
          type="button"
          onClick={() => setShowObog((v) => !v)}
          className="mt-2 ml-3 text-[12px] font-bold text-blue-600"
        >
          {showObog ? "OB・OGを隠す" : "OB・OGを表示する"}
        </button>
      )}
    </div>
  );
}
