"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { acceptInvite, type FormState } from "./actions";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { InvitePlayerPicker, type InvitePlayer } from "./InvitePlayerPicker";
import type { TeamCategory } from "@/lib/database.types";

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
  const [selectedIds, setSelectedIds] = useState<string[]>([""]);

  if (state.message) {
    return (
      <div className="bg-white border border-line rounded-2xl p-5 text-[13px] text-ink-soft text-center">
        {state.message}
      </div>
    );
  }

  return (
    <>
      <form action={formAction} className="bg-white border border-line rounded-2xl p-5">
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
