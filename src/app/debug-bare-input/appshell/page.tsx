// 切り分け用テストページ2: .app-shell/.auth-shell(position:fixed + color-mix()背景)の
// 中に、メール欄+パスワード欄を両方置いた場合にクラッシュするかを確認する
// (requiresStrongPasswordAssistanceはパスワード欄が同じform内にある時だけ判定される
// 可能性が高いため、両方置く)。原因特定後に削除する。
const boxStyle = { border: "2px solid black", padding: 8, fontSize: 16, display: "block", marginTop: 8 } as const;
export default function DebugBareInputAppShellPage() {
  return (
    <div className="app-shell auth-shell">
      <div style={{ padding: 24 }}>
        <p>app-shellの中の入力欄です。下のメール欄をタップしてください(パスワード欄も下にあります)。</p>
        <input type="email" name="email" autoComplete="username" style={boxStyle} />
        <input type="password" name="password" autoComplete="current-password" style={boxStyle} />
      </div>
    </div>
  );
}
