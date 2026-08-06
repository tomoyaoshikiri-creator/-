"use client";

import { useActionState } from "react";
import { acceptInvite, type FormState } from "./actions";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";

const initialState: FormState = {};

export function InviteForm({ token, roleLabel }: { token: string; roleLabel: string }) {
  const [state, formAction, pending] = useActionState(acceptInvite, initialState);

  if (state.message) {
    return (
      <div className="bg-white border border-line rounded-2xl p-5 text-[13px] text-ink-soft text-center">
        {state.message}
      </div>
    );
  }

  return (
    <form action={formAction} className="bg-white border border-line rounded-2xl p-5">
      <input type="hidden" name="token" value={token} />
      <div className="text-[12.5px] text-ink-soft mb-4">
        {roleLabel}としてチームに参加します。氏名とログイン情報を入力してください。
      </div>
      <FieldLabel>氏名</FieldLabel>
      <input name="name" className={inputClass()} placeholder="例:碧衣ママ" required />

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
        {pending ? "登録中…" : "参加する"}
      </SubmitButton>
    </form>
  );
}
