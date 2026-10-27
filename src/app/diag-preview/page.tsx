import { notFound } from "next/navigation";
import { DiagViewer } from "./DiagViewer";

// 白画面調査用の診断ページ。(app)・(auth)のレイアウトは継承せず、ルートレイアウト
// (src/app/layout.tsx、html/body/フォント/TapFeedback等)のみを継承するトップレベル
// ルートとして配置している(Next.js App Routerでは単一のルートレイアウトは全ルートに
// 継承されるため、これ以上の分離にはルートレイアウト自体の複数化が必要になり、
// viewport-fit/statusBarStyle周りの既存実装に影響するため今回は行わない)。
//
// NEXT_PUBLIC_DIAG_ENABLED=1でビルドした場合のみ存在し、未設定でビルドした場合は
// サーバー側でも必ず404を返す(ビルド時のコード除去とは別の、アクセス制限側の保険)。
export default function DiagPage() {
  if (process.env.NEXT_PUBLIC_DIAG_ENABLED !== "1") {
    notFound();
  }

  return (
    <>
      {/*
        Reactのhydrationやコンポーネント処理に依存しない、最小限のフォールバック表示。
        素のJS(DOM操作のみ)でlocalStorageの内容をそのまま表示するため、このページの
        React部分自体が表示できない状況でも、この内容だけは画面に残る。
      */}
      <pre
        id="diag-raw-dump"
        suppressHydrationWarning
        style={{
          margin: 0,
          padding: 16,
          fontFamily: "monospace",
          fontSize: 12,
          whiteSpace: "pre-wrap",
          background: "#fff",
          color: "#000",
          borderBottom: "1px solid #ccc",
        }}
      >
        読み込み中...
      </pre>
      <script
        dangerouslySetInnerHTML={{
          __html:
            '(function(){try{var el=document.getElementById("diag-raw-dump");if(!el)return;var raw=localStorage.getItem("diag.v1");el.textContent=raw?raw:"(記録なし)";}catch(e){}})();',
        }}
      />
      <DiagViewer />
    </>
  );
}
