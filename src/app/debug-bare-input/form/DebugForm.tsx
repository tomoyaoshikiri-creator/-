"use client";

import { useActionState } from "react";
import { debugNoopAction } from "./actions";

// 切り分け用テストページ3: useActionState(React Server Actions)で駆動する<form>の中に
// 素の<input>を置いた場合にクラッシュするかを確認する。原因特定後に削除する。
export function DebugForm() {
  const [, formAction] = useActionState(debugNoopAction, {});
  return (
    <form action={formAction}>
      <p>Server Actionのformの中の入力欄です。下のメール欄をタップしてください。</p>
      <input type="email" name="email" style={{ border: "2px solid black", padding: 8, fontSize: 16 }} />
    </form>
  );
}
