"use client";

import { useEffect } from "react";
import Link from "next/link";

// アプリ全体の最終フォールバック。個別ページのエラーハンドリングを補うためのもので、
// 通常は個別ページ側のtry/catch・トースト表示で処理しきれなかった予期しない例外のみここに届く。
// B-1で導入したSentry(@sentry/node)はNode.js runtime専用で、このファイルを含む
// クライアントコンポーネントからは呼べない。クライアント側エラー捕捉(@sentry/browser等)は
// 今回のスコープ外とし、console.errorのまま残している。
//
// 2026-10: iPad mini Safariでログイン画面のメールアドレス欄をタップすると本画面に
// 落ちる不具合の調査のため、一時的にerror.message/digest/stackを画面上に表示する
// ようにしている(通常は実機でconsoleを見る手段がないため)。原因特定後は
// このメッセージ表示部分を削除して元に戻すこと。next.config.tsの
// productionBrowserSourceMaps有効化とセットの対応。
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
          <button type="button" onClick={() => reset()} className="text-[12.5px] font-bold text-orange-text">
            再読み込み
          </button>
          <Link href="/" className="text-[12.5px] font-bold text-orange-text">
            トップへ戻る
          </Link>
        </div>

        <div className="mt-8 text-left bg-white border border-line rounded-lg p-3">
          <div className="text-[11px] font-bold text-ink-soft mb-1.5">
            調査用の一時表示(この枠は原因特定後に削除します)
          </div>
          <div className="text-[11px] text-ink-soft mb-1">
            name: <span className="font-mono text-ink">{error.name}</span>
          </div>
          <div className="text-[11px] text-ink-soft mb-1">
            message: <span className="font-mono text-ink break-words">{error.message || "(なし)"}</span>
          </div>
          {error.digest && (
            <div className="text-[11px] text-ink-soft mb-1">
              digest: <span className="font-mono text-ink">{error.digest}</span>
            </div>
          )}
          <div className="text-[11px] text-ink-soft mt-2 mb-1">stack:</div>
          <pre className="text-[10px] text-ink whitespace-pre-wrap break-words bg-paper border border-line rounded p-2 max-h-[40vh] overflow-y-auto select-text">
            {error.stack || "(スタックトレースがありません)"}
          </pre>
        </div>
      </div>
    </div>
  );
}
