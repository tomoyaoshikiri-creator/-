"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUpTeam, type FormState } from "./actions";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";

const initialState: FormState = {};

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signUpTeam, initialState);

  if (state.message) {
    return (
      <div className="bg-white border border-line rounded-lg p-5 text-[13px] text-ink-soft text-center">
        {state.message}
      </div>
    );
  }

  return (
    <form action={formAction} className="bg-white border border-line rounded-lg p-5">
      <div className="text-[12.5px] text-ink-soft mb-4">
        新しくチームを立ち上げます。メールアドレスの確認後、チーム名など詳細を入力していただきます。
      </div>

      <FieldLabel>メールアドレス</FieldLabel>
      <input name="email" type="email" className={inputClass()} required />

      <div className="mt-3">
        <FieldLabel>パスワード(8文字以上)</FieldLabel>
        <input name="password" type="password" minLength={8} className={inputClass()} required />
      </div>

      {state.error && <div className="mt-3 text-[12.5px] text-danger">{state.error}</div>}

      <SubmitButton type="submit" disabled={pending}>
        {pending ? "送信中…" : "確認メールを送信する"}
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
