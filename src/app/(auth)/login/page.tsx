import { AuthHeading } from "../AuthHeading";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; next?: string }>;
}) {
  const { error, notice, next } = await searchParams;
  return (
    <div>
      <AuthHeading />
      {error && (
        <div className="mb-3 text-[12.5px] text-danger text-center bg-white border border-line rounded-lg p-3">
          {error === "confirm_failed" ? "確認リンクが無効か期限切れです。もう一度お試しください。" : error}
        </div>
      )}
      {notice === "inactivity" && (
        <div className="mb-3 text-[12.5px] text-ink-soft text-center bg-white border border-line rounded-lg p-3 text-pretty">
          しばらく操作がなかったため、自動的にログアウトしました。
          <br />
          もう一度ログインしてください。
        </div>
      )}
      <LoginForm next={next} />
    </div>
  );
}
