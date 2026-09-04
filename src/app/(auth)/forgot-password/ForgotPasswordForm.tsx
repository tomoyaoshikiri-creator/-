"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, type FormState } from "./actions";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";

const initialState: FormState = {};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  if (state.message) {
    return (
      <div className="bg-white border border-line rounded-lg p-5 text-center">
        <div className="text-[13px] text-ink">{state.message}</div>
        <Link href="/login" className="inline-block mt-4 text-orange font-bold text-[12.5px]">
          ログイン画面に戻る
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="bg-white border border-line rounded-lg p-5">
      <div className="text-[12.5px] text-ink-soft mb-4">
        登録済みのメールアドレスを入力してください。パスワード再設定用のリンクをお送りします。
      </div>
      <FieldLabel>メールアドレス</FieldLabel>
      <input name="email" type="email" className={inputClass()} required />

      {state.error && <div className="mt-3 text-[12.5px] text-danger">{state.error}</div>}

      <SubmitButton type="submit" disabled={pending}>
        {pending ? "送信中…" : "再設定メールを送信"}
      </SubmitButton>

      <div className="text-center text-[12px] text-ink-soft mt-4">
        <Link href="/login" className="text-orange font-bold">
          ログイン画面に戻る
        </Link>
      </div>
    </form>
  );
}
