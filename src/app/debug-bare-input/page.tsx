// 一時的な切り分け用ページ。ログイン画面のクラッシュ原因切り分けのため、
// app-shell等のレイアウト・CSS・JSを一切使わない最小限の<input>のみを置く。
// 原因特定後は削除する。
export default function DebugBareInputPage() {
  return (
    <div>
      <p>これは入力欄1つだけのテストページです。下のメール欄をタップしてください。</p>
      <input type="email" name="email" style={{ border: "2px solid black", padding: 8, fontSize: 16 }} />
    </div>
  );
}
