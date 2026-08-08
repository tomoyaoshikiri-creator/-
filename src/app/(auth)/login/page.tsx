import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { error, notice } = await searchParams;
  return (
    <div>
      {error && (
        <div className="mb-3 text-[12.5px] text-danger text-center bg-white border border-line rounded-2xl p-3">
          {error === "confirm_failed" ? "確認リンクが無効か期限切れです。もう一度お試しください。" : error}
        </div>
      )}
      {notice === "inactivity" && (
        <div className="mb-3 text-[12.5px] text-ink-soft text-center bg-white border border-line rounded-2xl p-3">
          しばらく操作がなかったため、自動的にログアウトしました。
          <br />
          もう一度ログインしてください。
        </div>
      )}
      <LoginForm />
    </div>
  );
}
