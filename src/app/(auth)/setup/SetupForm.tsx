"use client";

import { useActionState, useState } from "react";
import { completeSetup, type FormState } from "./actions";
import { FieldLabel, SegButton, SubmitButton, inputClass } from "@/components/ui/SegButton";
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
        <input type="hidden" name="sport" value={sport} />
        <div className="flex gap-1.5 flex-wrap">
          {SPORTS.map((s) => (
            <SegButton key={s} variant="small" active={sport === s} onClick={() => setSport(s)} className="flex-none px-3.5">
              {SPORT_DISPLAY_LABELS[s]}
            </SegButton>
          ))}
        </div>
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
