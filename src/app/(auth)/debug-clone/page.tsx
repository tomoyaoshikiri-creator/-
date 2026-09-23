import { AuthHeading } from "../AuthHeading";
import { DebugCloneForm } from "./DebugCloneForm";

// login/page.tsxの構成をほぼそのまま複製したテストページ(再掲)。原因特定後に削除する。
export default async function DebugClonePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; next?: string }>;
}) {
  const { error, notice } = await searchParams;
  return (
    <div>
      <AuthHeading />
      {error && (
        <div className="mb-3 text-[12.5px] text-danger text-center bg-white border border-line rounded-lg p-3">
          {error}
        </div>
      )}
      {notice === "inactivity" && (
        <div className="mb-3 text-[12.5px] text-ink-soft text-center bg-white border border-line rounded-lg p-3 text-pretty">
          しばらく操作がなかったため、自動的にログアウトしました。
          <br />
          もう一度ログインしてください。
        </div>
      )}
      <DebugCloneForm />
    </div>
  );
}
