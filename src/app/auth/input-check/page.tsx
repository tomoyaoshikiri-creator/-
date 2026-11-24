export default function InputCheckPage() {
  return (
    <main style={{ maxWidth: 600, margin: "0 auto", padding: 24, background: "white" }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>共通処理ありの入力テスト</h1>
      <p style={{ marginBottom: 16 }}>入力欄をタップして、テスト用の文字を入力してください。</p>
      <label htmlFor="test-input">テスト入力欄</label>
      <input
        id="test-input"
        type="email"
        autoComplete="off"
        name="email"
        style={{ boxSizing: "border-box", width: "100%", font: "16px system-ui", padding: 14, border: "1px solid #666", borderRadius: 4 }}
      />
      <p style={{ marginTop: 16 }}>入力内容を送信・保存しません。</p>
    </main>
  );
}
