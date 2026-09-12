"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUpTeam, verifySignupCode, resendSignupCode, type FormState } from "./actions";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { TermsAgreementCheckbox } from "@/components/ui/TermsAgreementCheckbox";
import { TurnstileWidget } from "@/components/TurnstileWidget";

const initialState: FormState = {};
const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signUpTeam, initialState);
  const [verifyState, verifyFormAction, verifying] = useActionState(verifySignupCode, initialState);
  const [resendState, resendFormAction, resending] = useActionState(resendSignupCode, initialState);

  // メール確認コードの送信後は、メール内のリンクの代わりに6桁のコードをその場で
  // 入力して完了させる(ネイティブアプリ化時のディープリンク依存を避けるため)。
  // リンク経由(/auth/confirm)も引き続き有効なままなので、どちらを使っても完了する。
  if (state.awaitingCode) {
    const email = verifyState.email ?? state.email ?? "";
    return (
      <div className="bg-white border border-line rounded-lg p-5">
        <div className="text-[12.5px] text-ink-soft mb-1">
          {email} 宛に確認コードを送信しました。メールに記載の6桁のコードを入力してください。
        </div>
        <div className="text-[11px] text-ink-soft mb-4">
          メールが届かない場合は、迷惑メールフォルダもご確認ください。
        </div>

        <form action={verifyFormAction}>
          <input type="hidden" name="email" value={email} />
          <FieldLabel htmlFor="code">確認コード(6桁)</FieldLabel>
          <input
            id="code"
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
        新しくチームを立ち上げます。メールアドレスの確認後、チーム名など詳細を入力していただきます。
      </div>

      <FieldLabel htmlFor="email">メールアドレス</FieldLabel>
      <input id="email" name="email" type="email" className={inputClass()} required />

      <div className="mt-3">
        <FieldLabel htmlFor="password">パスワード(8文字以上)</FieldLabel>
        <input id="password" name="password" type="password" minLength={8} className={inputClass()} required />
      </div>

      <TermsAgreementCheckbox />

      {turnstileSiteKey && <TurnstileWidget siteKey={turnstileSiteKey} />}

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
