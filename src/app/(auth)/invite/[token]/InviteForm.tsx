"use client";

import { useActionState, useState } from "react";
import { acceptInvite, type FormState } from "./actions";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { gradeLabel, playerFullName, sortPlayers } from "@/lib/format";
import type { Player, TeamCategory } from "@/lib/database.types";

const initialState: FormState = {};

type InvitePlayer = Pick<Player, "id" | "sei" | "mei" | "grade" | "number">;

export function InviteForm({
  token,
  roleLabel,
  players,
  category,
}: {
  token: string;
  roleLabel: string;
  players: InvitePlayer[];
  category: TeamCategory;
}) {
  const [state, formAction, pending] = useActionState(acceptInvite, initialState);
  const [selectedIds, setSelectedIds] = useState<string[]>([""]);

  if (state.message) {
    return (
      <div className="bg-white border border-line rounded-2xl p-5 text-[13px] text-ink-soft text-center">
        {state.message}
      </div>
    );
  }

  const sortedPlayers = sortPlayers(players as (InvitePlayer & { grade: string | null; number: string | null })[]);

  function setSelection(index: number, value: string) {
    setSelectedIds((prev) => prev.map((id, i) => (i === index ? value : id)));
  }

  function addRow() {
    setSelectedIds((prev) => [...prev, ""]);
  }

  function removeRow(index: number) {
    setSelectedIds((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <form action={formAction} className="bg-white border border-line rounded-2xl p-5">
      <input type="hidden" name="token" value={token} />
      <div className="text-[12.5px] text-ink-soft mb-4">
        {roleLabel}としてチームに参加します。氏名とログイン情報を入力してください。
      </div>
      <FieldLabel>氏名</FieldLabel>
      <div className="flex gap-2">
        <input name="sei" className={inputClass()} placeholder="氏:山田" required />
        <input name="mei" className={inputClass()} placeholder="名:太郎" required />
      </div>

      <div className="mt-3">
        <FieldLabel>メールアドレス</FieldLabel>
        <input name="email" type="email" className={inputClass()} required />
      </div>

      <div className="mt-3">
        <FieldLabel>パスワード(8文字以上)</FieldLabel>
        <input name="password" type="password" minLength={8} className={inputClass()} required />
      </div>

      {sortedPlayers.length > 0 && (
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
      )}

      {state.error && <div className="mt-3 text-[12.5px] text-danger">{state.error}</div>}

      <SubmitButton type="submit" disabled={pending}>
        {pending ? "登録中…" : "参加する"}
      </SubmitButton>
    </form>
  );
}
