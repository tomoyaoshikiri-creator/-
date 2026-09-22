// 切り分け用テストページ2: .app-shell/.auth-shell(position:fixed + color-mix()背景)の
// 中に素の<input>を置いた場合にクラッシュするかを確認する。原因特定後に削除する。
export default function DebugBareInputAppShellPage() {
  return (
    <div className="app-shell auth-shell">
      <div style={{ padding: 24 }}>
        <p>app-shellの中の入力欄です。下のメール欄をタップしてください。</p>
        <input type="email" name="email" style={{ border: "2px solid black", padding: 8, fontSize: 16 }} />
      </div>
    </div>
  );
}
