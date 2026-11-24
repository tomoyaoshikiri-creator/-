import { LoginForm } from "../../(auth)/login/LoginForm";

export default function InputCheckFormPage() {
  return (
    <main style={{ maxWidth: 600, margin: "0 auto", padding: 24, background: "white" }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>ログインフォーム単体テスト</h1>
      <p style={{ marginBottom: 16 }}>メール欄をタップして、テスト用の文字を入力してください。「次へ」はまだ押さなくて大丈夫です。</p>
      <LoginForm />
    </main>
  );
}
