import { AuthHeading } from "@/app/(auth)/AuthHeading";
import { DebugCloneForm } from "./DebugCloneForm";

// (auth)/layout.tsx + login/page.tsx + LoginForm.tsxの構成をほぼそのまま複製した
// テストページ。app-shell/auth-shell + AuthHeading(ロゴ画像) + 本物のLoginForm相当の
// コンポーネントを全て含む。原因特定後に削除する。
export default function DebugBareInputClonePage() {
  return (
    <div className="app-shell auth-shell">
      <div className="flex-1 overflow-y-auto flex flex-col justify-center-safe px-6 py-10">
        <div>
          <AuthHeading />
          <DebugCloneForm />
        </div>
      </div>
    </div>
  );
}
