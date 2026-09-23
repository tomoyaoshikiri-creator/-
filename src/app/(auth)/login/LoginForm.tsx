"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, type FormState } from "./actions";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";

const initialState: FormState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="bg-white border border-line rounded-lg p-5">
      <input type="hidden" name="next" value={next ?? ""} />
      {/*
        autoCompleteを明示するのは、iPadOS Safariでこのフォームをタップした際に
        Safari側のAutoFill(パスワード提案)処理内でクラッシュする不具合の対策。
        autoComplete未指定だとSafariが「既存ログインか新規パスワード作成か」を
        自前で推測しようとし、その判定処理(requiresStrongPasswordAssistance)の
        先でUIKitのAuto Layout関連のクラッシュ(NSException→abort)を引き起こす
        実機クラッシュログを確認した。既存ログインであることを明示することで
        この推測処理自体を避ける狙い。
      */}
      <FieldLabel htmlFor="email">メールアドレス</FieldLabel>
      <input id="email" name="email" type="email" autoComplete="username" className={inputClass()} required />

      <div className="mt-3">
        <FieldLabel htmlFor="password">パスワード</FieldLabel>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className={inputClass()}
          required
        />
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
