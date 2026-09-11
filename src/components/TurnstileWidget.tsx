"use client";

import Script from "next/script";

// Cloudflare Turnstile(CAPTCHA)のクライアント側ウィジェット。NEXT_PUBLIC_TURNSTILE_SITE_KEY
// 未設定時は呼び出し元がそもそも描画しない(鍵の取得・設定自体は人間対応、C-2参照)。
// フォーム内に置くと、検証成功時にウィジェットが自動でcf-turnstile-responseという
// hidden inputを生成し、通常のFormDataとして一緒に送信される(追加のJS連携は不要)。
export function TurnstileWidget({ siteKey }: { siteKey: string }) {
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      <div className="cf-turnstile my-3" data-sitekey={siteKey} />
    </>
  );
}
