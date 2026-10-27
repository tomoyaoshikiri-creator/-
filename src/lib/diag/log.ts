// プレビュー限定の白画面調査用診断ログ。NEXT_PUBLIC_DIAG_ENABLED=1でビルドした場合のみ、
// src/app/layout.tsxの早期インラインスクリプト(beforeInteractive)がwindow.__diagを
// 用意する。本番相当ビルド(同変数未設定)ではwindow.__diagは存在せず、ここでのcheckpoint
// 呼び出しは常にno-opになる(localStorageへの書き込み・読み出しは一切発生しない)。
// 個人情報・認証トークン・Cookieはここでは一切扱わない(記録先の実装はlayout.tsx参照)。
export function diagCheckpoint(name: string): void {
  if (process.env.NEXT_PUBLIC_DIAG_ENABLED !== "1") return;
  try {
    const diag = (window as unknown as { __diag?: { checkpoint: (name: string) => void } }).__diag;
    diag?.checkpoint(name);
  } catch {
    // 診断記録の失敗がアプリ本体の動作に影響しないようにする。
  }
}
