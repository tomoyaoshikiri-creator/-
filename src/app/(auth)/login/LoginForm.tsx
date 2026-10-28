"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { login, type FormState } from "./actions";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { diagCheckpoint } from "@/lib/diag/log";

const initialState: FormState = {};

// iPad miniのSafariで、メールアドレス欄とパスワード欄が同じ画面(同じDOM)に並ぶと、
// どちらかの欄をタップした瞬間にSafariごと落ちる不具合が実機で確認されている
// (姉妹アプリPATH KARTEでの切り分けにより判明。オーナー承認済みの対策方針)。
// アプリ側のCSS・JS・autoCompleteの書き方では避けられないSafari(iPadOS)側の不具合と
// みられるため、欄を2画面に分けて同時にDOMへ出さないことで回避する。
// 1画面目(メールアドレスのみ)→2画面目(パスワードのみ)の順で、2画面目にはメールアドレスを
// hidden inputで持たせて既存のlogin server actionへそのまま渡す(サーバー側は無変更)。
// この2段階構成を1画面に戻さないこと。
export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(login, initialState);
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "password">("email");

  // ホワイトスクリーン問題調査用。「login-form-client-mount」はこのコンポーネントの
  // useEffectがこの時点まで到達した事実のみを示し、Hydration全体の完了を意味しない。
  // NEXT_PUBLIC_DIAG_ENABLED未設定時はdiagCheckpointが常にno-opになる。
  useEffect(() => {
    diagCheckpoint("login-form-client-mount");
    const raf = requestAnimationFrame(() => {
      diagCheckpoint("login-form-mount-plus-1-frame");
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  if (step === "email") {
    return (
      <form
        className="bg-white border border-line rounded-lg p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim()) setStep("password");
        }}
      >
        <FieldLabel htmlFor="email">メールアドレス</FieldLabel>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="off"
          className={inputClass()}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <SubmitButton type="submit">次へ</SubmitButton>

        <div className="text-center text-[12px] mt-3">
          <Link href="/forgot-password" className="text-ink-soft font-bold">
            パスワードをお忘れですか?
          </Link>
        </div>

        <div className="text-center text-[12px] text-ink-soft mt-4">
          はじめての方は{" "}
          <Link href="/signup" className="text-orange-text font-bold">
            こちらから
          </Link>
          チームを作成してください。
          <br />
          招待リンクをお持ちの方はそちらから登録してください。
        </div>
      </form>
    );
  }

  return (
    <form action={formAction} className="bg-white border border-line rounded-lg p-5">
      <input type="hidden" name="next" value={next ?? ""} />
      <input type="hidden" name="email" value={email.trim()} />

      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12.5px] text-ink truncate">{email.trim()}</span>
        <button type="button" onClick={() => setStep("email")} className="text-[11.5px] text-orange-text font-bold flex-shrink-0 ml-2">
          変更
        </button>
      </div>

      <FieldLabel htmlFor="password">パスワード</FieldLabel>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        className={inputClass()}
        required
      />

      {state.error && <div className="mt-3 text-[12.5px] text-danger-text">{state.error}</div>}

      <SubmitButton type="submit" disabled={pending}>
        {pending ? "ログイン中…" : "ログイン"}
      </SubmitButton>

      <div className="text-center text-[12px] mt-3">
        <Link href="/forgot-password" className="text-ink-soft font-bold">
          パスワードをお忘れですか?
        </Link>
      </div>
    </form>
  );
}
