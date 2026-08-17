"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signUpTeam, type FormState } from "./actions";
import { FieldLabel, SegButton, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { SPORTS, SPORT_DISPLAY_LABELS } from "@/lib/sport";

const initialState: FormState = {};

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signUpTeam, initialState);
  const [sport, setSport] = useState(SPORTS[0]);

  if (state.message) {
    return (
      <div className="bg-white border border-line rounded-2xl p-5 text-[13px] text-ink-soft text-center">
        {state.message}
      </div>
    );
  }

  return (
    <form action={formAction} className="bg-white border border-line rounded-2xl p-5">
      <div className="text-[12.5px] text-ink-soft mb-4">
        新しくチームを立ち上げます。登録した方が最初の管理者になります。
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

      <div className="mt-3">
        <FieldLabel>メールアドレス</FieldLabel>
        <input name="email" type="email" className={inputClass()} required />
      </div>

      <div className="mt-3">
        <FieldLabel>パスワード(8文字以上)</FieldLabel>
        <input name="password" type="password" minLength={8} className={inputClass()} required />
      </div>

      {state.error && <div className="mt-3 text-[12.5px] text-danger">{state.error}</div>}

      <SubmitButton type="submit" disabled={pending}>
        {pending ? "作成中…" : "チームを作成する"}
      </SubmitButton>

      <div className="text-center text-[12px] text-ink-soft mt-4">
        すでにアカウントをお持ちですか?{" "}
        <Link href="/login" className="text-orange font-bold">
          ログイン
        </Link>
      </div>
    </form>
  );
}
