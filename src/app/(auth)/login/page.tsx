import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div>
      {error && (
        <div className="mb-3 text-[12.5px] text-danger text-center bg-white border border-line rounded-2xl p-3">
          {error === "confirm_failed" ? "確認リンクが無効か期限切れです。もう一度お試しください。" : error}
        </div>
      )}
      <LoginForm />
    </div>
  );
}
