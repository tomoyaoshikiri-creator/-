import type { Metadata, Viewport } from "next";
import { Cormorant, Noto_Sans_JP, Roboto_Mono } from "next/font/google";
import Script from "next/script";
import { TapFeedback } from "@/components/TapFeedback";
import "./globals.css";

// ログイン画面の白画面問題(2026-10)調査用の診断ログ。NEXT_PUBLIC_DIAG_ENABLED=1を
// 明示的に設定した場合のみビルドに含まれ、本番環境では設定しないため常にこのif分岐が
// 丸ごと除去される想定だが、除去の有無は前提とせず実際のビルド生成物で確認すること
// (報告時に記載)。記録はlocalStorageのみ(diag.v1キー)、個人情報・認証トークン・
// Cookieは扱わない。詳細はsrc/app/diag-preview/page.tsx・src/lib/diag/log.ts参照。
const DIAG_ENABLED = process.env.NEXT_PUBLIC_DIAG_ENABLED === "1";

const DIAG_EARLY_SCRIPT = `
(function () {
  try {
    var KEY = "diag.v1";
    var MAX_SESSIONS = 20;
    var MAX_EVENTS = 50;

    function sanitize(s) {
      s = String(s == null ? "" : s);
      s = s.slice(0, 200);
      s = s.replace(/[\\w.+-]+@[\\w.-]+\\.[A-Za-z]{2,}/g, "[email]");
      s = s.replace(/[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{5,}\\.[A-Za-z0-9_-]{5,}/g, "[jwt]");
      s = s.replace(/[A-Za-z0-9+/]{32,}={0,2}/g, "[token]");
      return s;
    }

    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) {}
    var data;
    try { data = raw ? JSON.parse(raw) : { sessions: [] }; } catch (e) { data = { sessions: [] }; }
    if (!data || !Array.isArray(data.sessions)) data = { sessions: [] };

    var session = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      startedAt: Date.now(),
      path: (location && location.pathname) || "",
      events: [{ t: Date.now(), k: "early-script-executed" }],
      ended: false,
      endReason: null
    };
    data.sessions.push(session);
    while (data.sessions.length > MAX_SESSIONS) data.sessions.shift();

    function save() {
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
    }
    save();

    function addEvent(k) {
      try {
        session.events.push({ t: Date.now(), k: sanitize(k) });
        while (session.events.length > MAX_EVENTS) session.events.shift();
        save();
      } catch (e) {}
    }

    function markEnded(reason) {
      try {
        session.ended = true;
        session.endReason = sanitize(reason);
        save();
      } catch (e) {}
    }

    try {
      window.addEventListener("error", function (e) {
        addEvent("js-error:" + sanitize((e && (e.message || (e.error && e.error.message))) || ""));
      });
      window.addEventListener("unhandledrejection", function (e) {
        var r = e && e.reason;
        addEvent("unhandled-rejection:" + sanitize((r && r.message) || r || ""));
      });
      document.addEventListener("visibilitychange", function () {
        addEvent("visibility:" + document.visibilityState);
      });
      window.addEventListener("pagehide", function () { markEnded("pagehide"); });
      window.addEventListener("beforeunload", function () { markEnded("beforeunload"); });
    } catch (e) {}

    window.__diag = {
      checkpoint: function (name) { addEvent(sanitize(name)); }
    };
  } catch (e) {}
})();
`;

const cormorant = Cormorant({
  variable: "--font-display-serif",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  weight: ["500", "700"],
});

// タブバーがホームインジケーター手前(約68pt)で止まる問題について、padding拡張・
// position:fixed・document.bodyへのportal・manifest.display変更・
// viewport-fit=cover撤去(status barを不透明に戻す)の5方式を実機のピクセル解析
// (マゼンタ等の判別可能な色での検証を含む)で確認したが、タブバーの位置は
// いずれも変化しなかった。この約68pt帯はページ側のCSS/manifestでは制御できない、
// ホーム画面追加(standalone)時のiOS側の予約領域として受け入れる。
// Next.jsのMetadata API(appleWebApp.capable)は標準の"mobile-web-app-capable"
// (apple-プレフィックス無し)しか出力せず、旧来の"apple-mobile-web-app-capable"
// (apple-プレフィックス付き)は出力しない。iOSのホーム画面追加(standalone)は
// 依然としてapple-プレフィックス付きの方を見ており、これが無いと
// viewport-fit=cover / apple-mobile-web-app-status-bar-styleを指定していても
// env(safe-area-inset-*)が正しく機能しない(常に0扱いになる)ケースがある。
// otherフィールドで明示的に追加する。
//
// statusBarStyle / viewport-fit の経緯(2026-10):
// 1. iPad mini Safariでログイン画面の入力欄をタップするとSafariごとクラッシュする
//    不具合が実機で確認された(原因はiPadOS側のバグ。画面キーボードのレイアウト
//    切り替えとAutoFillの判定処理が重なるタイミングで未処理の例外が発生している
//    ことを実機のクラッシュログで確認済み)。
// 2. 疑わしかったCSSのcolor-mix()をアプリ全体から完全に除去した状態でも、
//    statusBarStyleを"black-translucent"に戻すと数分以内にクラッシュが再現する
//    ことを確認した(="default"への変更自体がcrash対策として必要だった)。
// 3. "default"に変更した結果、viewport-fit=cover(本来black-translucentと
//    セットの設定)との食い違いにより.app-shell(position:fixed; inset:0)の
//    高さが実機の画面高さと合わず、画面下部に原因不明の余白ができる不具合が
//    発生したため、一旦viewport-fitも撤去した。
// 4. その後、.app-shellの高さをheight:100dvh(env(safe-area-inset-*)に依存しない
//    動的ビューポート単位)で明示する対応に切り替えた。これによりcover/非cover
//    どちらの組み合わせでも.app-shellの高さが実機と一致するようになったため、
//    フチなしヘッダーのデザインを優先し、viewport-fit=cover +
//    statusBarStyle="black-translucent"に戻した。
//    ⚠️ 上記2.の通り、この組み合わせは過去に実機でクラッシュが再現した設定であり、
//    原因はiPadOS側のバグで完全な回避保証はない。再発した場合は直ちに
//    "default" + viewport-fit撤去に戻すこと(このコメント追加前の版を参照)。
export const metadata: Metadata = {
  title: "CIRCLE LINES",
  description: "CIRCLE LINES — チーム運営プラットフォーム",
  applicationName: "CIRCLE LINES",
  appleWebApp: {
    capable: true,
    title: "CIRCLE LINES",
    statusBarStyle: "black-translucent",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // PR #213(共通ナビゲーション刷新)の実機フィードバック調査により追加。
  // <meta name="theme-color">に相当するものがこれまで未設定だったため、Safari
  // 通常タブのアドレスバー等は常にOS標準色のままだった。manifest.tsのtheme_color、
  // および--header-gradient(ヘッダーのブランドグラデーション)の中間色として
  // 既に使われているブランドブルーと同じ値を指定し、Safari自身のUIとページの
  // ブランド配色に一体感を持たせる。viewport-fit/statusBarStyle等、他の設定・
  // Safe Area関連CSSは変更していない。
  themeColor: "#087cf0",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${cormorant.variable} ${notoSansJP.variable} ${robotoMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {DIAG_ENABLED && (
          <Script id="diag-early" strategy="beforeInteractive">
            {DIAG_EARLY_SCRIPT}
          </Script>
        )}
        <TapFeedback />
        {children}
      </body>
    </html>
  );
}
