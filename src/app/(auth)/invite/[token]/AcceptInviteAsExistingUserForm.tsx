"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { acceptInviteAsExistingUser, type AcceptInviteAsExistingUserState } from "./actions";
import { SubmitButton } from "@/components/ui/SegButton";
import { InvitePlayerPicker, type InvitePlayer } from "./InvitePlayerPicker";
import type { TeamCategory } from "@/lib/database.types";

const initialState: AcceptInviteAsExistingUserState = {};

export function AcceptInviteAsExistingUserForm({
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
  const [state, formAction, pending] = useActionState(acceptInviteAsExistingUser, initialState);
  const [selectedIds, setSelectedIds] = useState<string[]>([""]);

  if (state.switchFailed) {
    return (
      <div className="bg-white border border-line rounded-lg p-5">
        <div className="text-[13px] text-ink-soft">
          チームへの参加は完了しましたが、この端末での切り替えに失敗しました。お手数ですが、下のボタンから手動でチームを切り替えてください。
        </div>
        <Link
          href="/select-team"
          className="mt-3.5 block w-full py-2.5 rounded-lg bg-navy text-white font-bold text-[13px] text-center active:opacity-85"
        >
          チームを切り替える
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="bg-white border border-line rounded-lg p-5">
      <input type="hidden" name="token" value={token} />
      <div className="text-[12.5px] text-ink-soft mb-4">
        {roleLabel}としてこのチームに参加します。このアカウントで参加してよろしいですか?
      </div>

      <InvitePlayerPicker players={players} category={category} selectedIds={selectedIds} onChange={setSelectedIds} />

      {state.error && <div className="mt-3 text-[12.5px] text-danger">{state.error}</div>}

      <SubmitButton type="submit" disabled={pending}>
        {pending ? "参加処理中…" : "このアカウントで参加する"}
      </SubmitButton>
    </form>
  );
}
