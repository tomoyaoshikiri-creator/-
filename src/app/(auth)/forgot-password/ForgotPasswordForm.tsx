"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, verifyResetCode, resendResetCode, type FormState } from "./actions";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";

const initialState: FormState = {};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);
  const [verifyState, verifyFormAction, verifying] = useActionState(verifyResetCode, initialState);
  const [resendState, resendFormAction, resending] = useActionState(resendResetCode, initialState);

  // メール確認コードの送信後は、メール内のリンクの代わりに6桁のコードをその場で
  // 入力して完了させる(ネイティブアプリ化時のディープリンク依存を避けるため)。
  // リンク経由(/auth/confirm→/reset-password)も引き続き有効なままなので、
  // どちらを使っても新しいパスワードの設定に進める。
  if (state.awaitingCode) {
    const email = verifyState.email ?? state.email ?? "";
    return (
      <div className="bg-white border border-line rounded-lg p-5">
        <div className="text-[12.5px] text-ink-soft mb-4">
          {email} 宛にパスワード再設定用のコードを送信しました。メールに記載の6桁のコードを入力してください。
        </div>

        <form action={verifyFormAction}>
          <input type="hidden" name="email" value={email} />
          <FieldLabel>確認コード(6桁)</FieldLabel>
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className={inputClass()}
            autoFocus
            required
          />

          {verifyState.error && <div className="mt-3 text-[12.5px] text-danger">{verifyState.error}</div>}

          <SubmitButton type="submit" disabled={verifying}>
            {verifying ? "確認中…" : "確認する"}
          </SubmitButton>
        </form>

        <form action={resendFormAction} className="mt-3">
          <input type="hidden" name="email" value={email} />
          <button
            type="submit"
            disabled={resending}
            className="w-full text-center py-2 text-[12px] font-bold text-orange"
          >
            {resending ? "再送中…" : "コードを再送する"}
          </button>
          {resendState.message && (
            <div className="mt-1 text-[11.5px] text-ink-soft text-center">{resendState.message}</div>
          )}
          {resendState.error && <div className="mt-1 text-[11.5px] text-danger text-center">{resendState.error}</div>}
        </form>

        <div className="text-center text-[12px] text-ink-soft mt-4">
          <Link href="/login" className="text-orange font-bold">
            ログイン画面に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="bg-white border border-line rounded-lg p-5">
      <div className="text-[12.5px] text-ink-soft mb-4">
        登録済みのメールアドレスを入力してください。パスワード再設定用のコードをお送りします。
      </div>
      <FieldLabel>メールアドレス</FieldLabel>
      <input name="email" type="email" className={inputClass()} required />

      {state.error && <div className="mt-3 text-[12.5px] text-danger">{state.error}</div>}

      <SubmitButton type="submit" disabled={pending}>
        {pending ? "送信中…" : "再設定コードを送信"}
      </SubmitButton>

      <div className="text-center text-[12px] text-ink-soft mt-4">
        <Link href="/login" className="text-orange font-bold">
          ログイン画面に戻る
        </Link>
      </div>
    </form>
  );
}
