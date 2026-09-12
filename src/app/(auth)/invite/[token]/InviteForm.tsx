"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { acceptInvite, verifyInviteCode, resendInviteCode, type FormState } from "./actions";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { InvitePlayerPicker, type InvitePlayer } from "./InvitePlayerPicker";
import type { TeamCategory } from "@/lib/database.types";
import { TermsAgreementCheckbox } from "@/components/ui/TermsAgreementCheckbox";

const initialState: FormState = {};

export function InviteForm({
  token,
  roleLabel,
  players,
  category,
}: {
  token: string;
  roleLabel: string;
  players: InvitePlayer[];
  category: TeamCategory;
}) {
  const [state, formAction, pending] = useActionState(acceptInvite, initialState);
  const [verifyState, verifyFormAction, verifying] = useActionState(verifyInviteCode, initialState);
  const [resendState, resendFormAction, resending] = useActionState(resendInviteCode, initialState);
  const [selectedIds, setSelectedIds] = useState<string[]>([""]);

  // メール確認コードの送信後は、メール内のリンクの代わりに6桁のコードをその場で
  // 入力して完了させる(ネイティブアプリ化時のディープリンク依存を避けるため)。
  // リンク経由(/auth/confirm→/auth/complete)も引き続き有効なままなので、
  // どちらを使っても参加が完了する。
  if (state.awaitingCode) {
    const email = verifyState.email ?? state.email ?? "";
    const inviteToken = verifyState.token ?? state.token ?? token;
    const name = verifyState.name ?? state.name ?? "";
    const playerIds = verifyState.playerIds ?? state.playerIds ?? "";
    const agreedTermsVersion = verifyState.agreedTermsVersion ?? state.agreedTermsVersion ?? "";
    const agreedTermsAt = verifyState.agreedTermsAt ?? state.agreedTermsAt ?? "";

    return (
      <div className="bg-white border border-line rounded-lg p-5">
        <div className="text-[12.5px] text-ink-soft mb-4">
          {email} 宛に確認コードを送信しました。メールに記載の6桁のコードを入力してください。
        </div>

        <form action={verifyFormAction}>
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="token" value={inviteToken} />
          <input type="hidden" name="name" value={name} />
          <input type="hidden" name="playerIds" value={playerIds} />
          <input type="hidden" name="agreedTermsVersion" value={agreedTermsVersion} />
          <input type="hidden" name="agreedTermsAt" value={agreedTermsAt} />
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
    <>
      <form action={formAction} className="bg-white border border-line rounded-lg p-5">
        <input type="hidden" name="token" value={token} />
        <div className="text-[12.5px] text-ink-soft mb-4">
          {roleLabel}としてチームに参加します。氏名とログイン情報を入力してください。
        </div>
        <FieldLabel>氏名</FieldLabel>
        <div className="flex gap-2">
          <input name="sei" className={inputClass()} placeholder="氏:山田" required />
          <input name="mei" className={inputClass()} placeholder="名:太郎" required />
        </div>

        <div className="mt-3">
          <FieldLabel>メールアドレス</FieldLabel>
          <input name="email" type="email" className={inputClass()} required />
        </div>

        <div className="mt-3">
          <FieldLabel>パスワード(8文字以上)</FieldLabel>
          <input name="password" type="password" minLength={8} className={inputClass()} required />
        </div>

        <InvitePlayerPicker players={players} category={category} selectedIds={selectedIds} onChange={setSelectedIds} />

        <TermsAgreementCheckbox />

        {state.error && (
          <div className="mt-3 text-[12.5px] text-danger">
            {state.error}
            <div className="mt-1 text-ink-soft font-normal">すでにアカウントをお持ちの場合はログインしてください。</div>
          </div>
        )}

        <SubmitButton type="submit" disabled={pending}>
          {pending ? "登録中…" : "参加する"}
        </SubmitButton>
      </form>

      <div className="mt-3 text-center text-[12px] text-ink-soft">
        すでにアカウントをお持ちの方は
        <Link href={`/login?next=/invite/${token}`} className="text-orange font-bold">
          ログインしてから
        </Link>
        この招待に参加してください。
      </div>
    </>
  );
}
