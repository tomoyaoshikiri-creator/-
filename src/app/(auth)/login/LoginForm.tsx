"use client";

import { useState } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { login, type FormState } from "./actions";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";

const initialState: FormState = {};

// iPadOS SafariのAutoFill(パスワード提案)処理が、メール欄+パスワード欄を同じform内に
// 両方置いた状態でキーボードを表示しようとすると、キーボードのレイアウト切り替え
// (分割キーボードへの遷移)中にUIKitのAuto Layout関連でクラッシュする(NSException→abort)
// 不具合が、特定の実機(iPadOS 27.0 build 24A437)で確認された。autoComplete指定では
// 回避できなかったため、暫定的にメール欄→パスワード欄の2ステップに分割し、同じform内に
// email+passwordの2種類のtype inputが同時に存在しない構成にしている。
// 【暫定対応】このバグがAppleのアップデートで解消され次第、1ステップの元の構成
// (git log参照: このファイルの直前のバージョン)に戻すこと。
export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(login, initialState);
  const [step, setStep] = useState<"email" | "password">("email");
  const [email, setEmail] = useState("");

  if (step === "email") {
    return (
      <div className="bg-white border border-line rounded-lg p-5">
        <FieldLabel htmlFor="email">メールアドレス</FieldLabel>
        <input
          id="email"
          type="email"
          autoComplete="username"
          className={inputClass()}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <SubmitButton
          type="button"
          onClick={() => {
            if (email.trim()) setStep("password");
          }}
        >
          次へ
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
      </div>
    );
  }

  return (
    <form action={formAction} className="bg-white border border-line rounded-lg p-5">
      <input type="hidden" name="next" value={next ?? ""} />
      <input type="hidden" name="email" value={email} />

      <div className="flex items-center justify-between text-[12.5px] mb-3">
        <span className="text-ink-soft truncate">{email}</span>
        <button
          type="button"
          onClick={() => setStep("email")}
          className="text-orange font-bold flex-shrink-0 ml-2"
        >
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

      {state.error && <div className="mt-3 text-[12.5px] text-danger">{state.error}</div>}

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
