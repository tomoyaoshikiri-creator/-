"use client";

import { useActionState } from "react";
import { debugNoopAction } from "./actions";

// 切り分け用テストページ3: useActionState(React Server Actions)で駆動するform内に、
// 実際のログイン画面と同じくメール欄+パスワード欄を両方置いた場合にクラッシュするかを
// 確認する(requiresStrongPasswordAssistanceはパスワード欄が同じform内にある時だけ
// 判定される可能性が高いため、メール欄単体のテストでは再現しなかったと考えられる)。
// 原因特定後に削除する。
const boxStyle = { border: "2px solid black", padding: 8, fontSize: 16, display: "block", marginTop: 8 };
export function DebugForm() {
  const [, formAction] = useActionState(debugNoopAction, {});
  return (
    <form action={formAction}>
      <p>下のメール欄をタップしてください(パスワード欄も同じformにあります)。</p>
      <input type="email" name="email" autoComplete="username" style={boxStyle} />
      <input type="password" name="password" autoComplete="current-password" style={boxStyle} />
    </form>
  );
}
