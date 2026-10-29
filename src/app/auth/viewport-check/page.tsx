import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { ViewportDiagnostics } from "@/components/ViewportDiagnostics";

export const metadata: Metadata = {
  title: "CIRCLE LINES 下部表示の確認",
  manifest: "/auth/viewport-check.webmanifest",
};

// No account or team data: uses the production shell and PageShell geometry.
export default function ViewportCheckPage() {
  return (
    <div className="app-shell">
      {process.env.VERCEL_ENV === "preview" && <ViewportDiagnostics />}
      <div className="flex-1 flex min-[700px]:flex-row flex-col min-h-0">
        <div className="min-[700px]:h-full">
          <nav data-sidebar-scroll className="hidden min-[700px]:flex min-[700px]:h-full flex-col w-[145px] flex-shrink-0 border-r border-line bg-white px-2 overflow-y-auto" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)", paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}>
            <p className="font-bold mb-4">表示確認</p>
            {Array.from({ length: 18 }, (_, i) => <div key={i} className="min-h-11 py-3">メニュー {i + 1}</div>)}
            <div className="border-2 border-orange p-3">メニュー最下部</div>
          </nav>
        </div>
        <div className="flex-1 flex flex-col min-h-0 min-w-0 relative">
          <PageShell header={<header className="px-4.5 pb-3.5 bg-orange" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.625rem)" }}><h1 className="text-[22px] font-bold">下部表示の確認</h1><p>右上の計測表示で「本文・サイドバーを最下部へ」を押してください。</p></header>}>
            <div className="grid grid-cols-1 min-[700px]:grid-cols-2 gap-3">
              {Array.from({ length: 18 }, (_, i) => <section key={i} className="rounded-lg border border-line bg-white p-5"><h2 className="font-bold mb-3">確認カード {i + 1}</h2><p>ログイン不要の表示確認用画面です。</p></section>)}
            </div>
            <div className="mt-4 border-2 border-orange bg-white p-5 font-bold">本文の最下部：この枠の下辺まで見えるか確認してください。</div>
          </PageShell>
        </div>
      </div>
      <footer className="min-[700px]:hidden border-t border-line bg-paper p-3">下部ナビの位置確認</footer>
    </div>
  );
}
