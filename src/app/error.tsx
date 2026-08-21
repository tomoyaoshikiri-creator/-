"use client";

import { useEffect } from "react";
import Link from "next/link";

// アプリ全体の最終フォールバック。個別ページのエラーハンドリングを補うためのもので、
// 通常は個別ページ側のtry/catch・トースト表示で処理しきれなかった予期しない例外のみここに届く。
// console.errorはOPS-01(エラートラッキング導入)実装時に、ここをトラッキングSDKの呼び出しへ
// 差し替える前提の土台として置いている。
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-full bg-paper text-ink flex items-center justify-center">
      <div className="max-w-[720px] mx-auto px-6 py-12 text-center">
        <h1 className="font-medium text-2xl mt-6 mb-2">予期しないエラーが発生しました</h1>
        <p className="text-[12.5px] text-ink-soft leading-relaxed mb-8">
          お手数ですが、もう一度お試しください。解決しない場合は運営までお問い合わせください。
        </p>
        <div className="flex items-center justify-center gap-5">
          <button type="button" onClick={() => reset()} className="text-[12.5px] font-bold text-orange">
            再読み込み
          </button>
          <Link href="/" className="text-[12.5px] font-bold text-orange">
            トップへ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
