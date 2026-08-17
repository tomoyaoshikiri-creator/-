"use client";

import { useActionState, useState } from "react";
import { completeSetup, type FormState } from "./actions";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { SPORTS, SPORT_DISPLAY_LABELS } from "@/lib/sport";

const initialState: FormState = {};

export function SetupForm() {
  const [state, formAction, pending] = useActionState(completeSetup, initialState);
  const [sport, setSport] = useState(SPORTS[0]);

  return (
    <form action={formAction} className="bg-white border border-line rounded-2xl p-5">
      <div className="text-[12.5px] text-ink-soft mb-4">
        ログインは完了していますが、チームの作成がまだ終わっていません。チーム名とあなたの氏名を入力してください。
      </div>
      <FieldLabel>チーム名</FieldLabel>
      <input name="teamName" className={inputClass()} placeholder="例:〇〇クラブ" required />

      <div className="mt-3">
        <FieldLabel>競技を選択</FieldLabel>
        <select name="sport" className={inputClass()} value={sport} onChange={(e) => setSport(e.target.value as (typeof SPORTS)[number])}>
          {SPORTS.map((s) => (
            <option key={s} value={s}>
              {SPORT_DISPLAY_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3">
        <FieldLabel>あなたの氏名</FieldLabel>
        <div className="flex gap-2">
          <input name="adminSei" className={inputClass()} placeholder="氏:山田" required />
          <input name="adminMei" className={inputClass()} placeholder="名:太郎" required />
        </div>
      </div>

      {state.error && <div className="mt-3 text-[12.5px] text-danger">{state.error}</div>}

      <SubmitButton type="submit" disabled={pending}>
        {pending ? "作成中…" : "チームを作成する"}
      </SubmitButton>
    </form>
  );
}
