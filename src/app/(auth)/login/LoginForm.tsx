"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, type FormState } from "./actions";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";

const initialState: FormState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="bg-white border border-line rounded-2xl p-5">
      <FieldLabel>メールアドレス</FieldLabel>
      <input name="email" type="email" className={inputClass()} required />

      <div className="mt-3">
        <FieldLabel>パスワード</FieldLabel>
        <input name="password" type="password" className={inputClass()} required />
      </div>

      {state.error && <div className="mt-3 text-[12.5px] text-danger">{state.error}</div>}

      <SubmitButton type="submit" disabled={pending}>
        {pending ? "ログイン中…" : "ログイン"}
      </SubmitButton>

      <div className="text-center text-[12px] mt-3">
        <Link href="/forgot-password" className="text-ink-soft font-bold">
          パスワードをお忘れですか?
        </Link>
      </div>

      <div className="text-center text-[12px] text-ink-soft mt-4">
        はじめての方は{" "}
        <Link href="/signup" className="text-orange font-bold">
          こちらから
        </Link>
        チームを作成してください。
        <br />
        招待リンクをお持ちの方はそちらから登録してください。
      </div>
    </form>
  );
}
