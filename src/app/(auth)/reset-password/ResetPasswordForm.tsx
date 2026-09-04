"use client";

import { useActionState } from "react";
import { updatePassword, type FormState } from "./actions";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";

const initialState: FormState = {};

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePassword, initialState);

  return (
    <form action={formAction} className="bg-white border border-line rounded-lg p-5">
      <div className="text-[12.5px] text-ink-soft mb-4">新しいパスワードを設定してください。</div>
      <FieldLabel>新しいパスワード</FieldLabel>
      <input name="password" type="password" className={inputClass()} required />

      <div className="mt-3">
        <FieldLabel>新しいパスワード(確認)</FieldLabel>
        <input name="confirm" type="password" className={inputClass()} required />
      </div>

      {state.error && <div className="mt-3 text-[12.5px] text-danger">{state.error}</div>}

      <SubmitButton type="submit" disabled={pending}>
        {pending ? "変更中…" : "パスワードを変更する"}
      </SubmitButton>
    </form>
  );
}
