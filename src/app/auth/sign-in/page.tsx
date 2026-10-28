import { AuthHeading } from "../../(auth)/AuthHeading";
import { LoginForm } from "../../(auth)/login/LoginForm";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; next?: string }>;
}) {
  const { error, notice, next } = await searchParams;
  return (
    <main style={{ maxWidth: 600, margin: "0 auto", padding: 24, background: "white" }}>
      <AuthHeading />
      {error && (
        <p role="alert" className="mb-3 text-danger-text">
          {error === "confirm_failed" ? "確認リンクが無効か期限切れです。もう一度お試しください。" : error}
        </p>
      )}
      {notice === "inactivity" && (
        <p className="mb-3">しばらく操作がなかったため、自動的にログアウトしました。もう一度ログインしてください。</p>
      )}
      <LoginForm next={next} />
    </main>
  );
}
