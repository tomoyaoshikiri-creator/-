"use client";

import { useActionState } from "react";
import { debugNoopAction } from "../form/actions";

// 切り分け用テストページ4: .app-shell + useActionState(Server Actions)のform +
// メール欄+パスワード欄、を全て組み合わせた、実際のログイン画面に最も近い構成。
// 原因特定後に削除する。
const boxStyle = { border: "2px solid black", padding: 8, fontSize: 16, display: "block", marginTop: 8 } as const;

export function DebugFullForm() {
  const [, formAction] = useActionState(debugNoopAction, {});
  return (
    <div className="app-shell auth-shell">
      <div style={{ padding: 24 }}>
        <form action={formAction}>
          <p>app-shell + Server Action form + メール/パスワード欄です。メール欄をタップしてください。</p>
          <input type="email" name="email" autoComplete="username" style={boxStyle} />
          <input type="password" name="password" autoComplete="current-password" style={boxStyle} />
        </form>
      </div>
    </div>
  );
}
