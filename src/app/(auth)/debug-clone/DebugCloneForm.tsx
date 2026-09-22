"use client";

import { useActionState } from "react";
import Link from "next/link";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { debugNoopAction } from "../../debug-bare-input/form/actions";

// 切り分け用テストページ6: (auth)ルートグループの中に置くことで、(auth)/layout.tsxの
// footer等も含めて本物のログイン画面と完全に同じレイアウトを継承させる。
// LoginForm.tsxの構成をdummy actionに差し替えてほぼそのまま複製。
// 原因特定後に削除する。
const initialState = {};

export function DebugCloneForm({ next }: { next?: string }) {
  const [, formAction, pending] = useActionState(debugNoopAction, initialState);

  return (
    <form action={formAction} className="bg-white border border-line rounded-lg p-5">
      <input type="hidden" name="next" value={next ?? ""} />
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

      <SubmitButton type="submit" disabled={pending}>
        {pending ? "送信中…" : "テスト送信"}
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
