import { AuthHeading } from "../AuthHeading";
import { DebugCloneForm } from "./DebugCloneForm";

// login/page.tsxの構成をほぼそのまま複製したテストページ。(auth)ルートグループ内に
// 置くことで(auth)/layout.tsx(footer等)も本物のログイン画面と完全に同じものを継承する。
// error/notice=inactivityの通知バナーも含めて再現し、?notice=inactivityでの
// アクセスも試せるようにする。原因特定後に削除する。
export default async function DebugClonePage({
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
      <DebugCloneForm next={next} />
    </div>
  );
}
