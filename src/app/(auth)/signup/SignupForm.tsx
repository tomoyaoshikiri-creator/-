"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signUpTeam, verifySignupCode, resendSignupCode, type FormState } from "./actions";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { TurnstileWidget } from "@/components/TurnstileWidget";

const initialState: FormState = {};
const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

// iPad miniのSafariで、メールアドレス欄とパスワード欄が同じ画面に並ぶと落ちる不具合の対策。
// 理由はLoginForm.tsx参照。この2段階構成を1画面に戻さないこと。
export function SignupForm() {
  const [state, formAction, pending] = useActionState(signUpTeam, initialState);
  const [verifyState, verifyFormAction, verifying] = useActionState(verifySignupCode, initialState);
  const [resendState, resendFormAction, resending] = useActionState(resendSignupCode, initialState);
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "password">("email");

  // メール確認コードの送信後は、メール内のリンクの代わりに6桁のコードをその場で
  // 入力して完了させる(ネイティブアプリ化時のディープリンク依存を避けるため)。
  // リンク経由(/auth/confirm)も引き続き有効なままなので、どちらを使っても完了する。
  if (state.awaitingCode) {
    const email = verifyState.email ?? state.email ?? "";
    return (
      <div className="bg-white border border-line rounded-lg p-5">
        <div className="text-[12.5px] text-ink-soft mb-1">
          {email} 宛に確認コードを送信しました。メールに記載の確認コードを入力してください。
        </div>
        <div className="text-[11px] text-ink-soft mb-4">
          メールが届かない場合は、迷惑メールフォルダもご確認ください。
        </div>

        <form action={verifyFormAction}>
          <input type="hidden" name="email" value={email} />
          <FieldLabel htmlFor="code">確認コード</FieldLabel>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            className={inputClass()}
            autoFocus
            required
          />

          {verifyState.error && <div className="mt-3 text-[12.5px] text-danger-text">{verifyState.error}</div>}

          <SubmitButton type="submit" disabled={verifying}>
            {verifying ? "確認中…" : "確認する"}
          </SubmitButton>
        </form>

        <form action={resendFormAction} className="mt-3">
          <input type="hidden" name="email" value={email} />
          <button
            type="submit"
            disabled={resending}
            className="w-full text-center py-2 text-[12px] font-bold text-orange-text"
          >
            {resending ? "再送中…" : "コードを再送する"}
          </button>
          {resendState.message && (
            <div className="mt-1 text-[11.5px] text-ink-soft text-center">{resendState.message}</div>
          )}
          {resendState.error && <div className="mt-1 text-[11.5px] text-danger-text text-center">{resendState.error}</div>}
        </form>

        <div className="text-center text-[12px] text-ink-soft mt-4">
          <Link href="/login" className="text-orange-text font-bold">
            ログイン画面に戻る
          </Link>
        </div>
      </div>
    );
  }

  if (step === "email") {
    return (
      <form
        className="bg-white border border-line rounded-lg p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim()) setStep("password");
        }}
      >
        <div className="text-[12.5px] text-ink-soft mb-4">
          新しくチームを立ち上げます。メールアドレスの確認後、チーム名など詳細を入力していただきます。
        </div>

        <FieldLabel htmlFor="email">メールアドレス</FieldLabel>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          className={inputClass()}
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <SubmitButton type="submit">次へ</SubmitButton>

        <div className="text-center text-[12px] text-ink-soft mt-4">
          すでにアカウントをお持ちですか?{" "}
          <Link href="/login" className="text-orange-text font-bold">
            ログイン
          </Link>
        </div>
      </form>
    );
  }

  return (
    <form action={formAction} className="bg-white border border-line rounded-lg p-5">
      <input type="hidden" name="email" value={email.trim()} />

      <div className="flex items-center justify-between mb-3">
        <span className="text-[12.5px] text-ink truncate">{email.trim()}</span>
        <button type="button" onClick={() => setStep("email")} className="text-[11.5px] text-orange-text font-bold flex-shrink-0 ml-2">
          変更
        </button>
      </div>

      <FieldLabel htmlFor="password">パスワード(8文字以上)</FieldLabel>
      <input
        id="password"
        name="password"
        type="password"
        minLength={8}
        autoComplete="new-password"
        className={inputClass()}
        required
        autoFocus
      />

      {turnstileSiteKey && <TurnstileWidget siteKey={turnstileSiteKey} />}

      {state.error && <div className="mt-3 text-[12.5px] text-danger-text">{state.error}</div>}

      <SubmitButton type="submit" disabled={pending}>
        {pending ? "送信中…" : "確認メールを送信する"}
      </SubmitButton>
    </form>
  );
}
