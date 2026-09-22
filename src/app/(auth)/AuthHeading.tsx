import { BRAND_NAVY } from "@/lib/theme";

const FONT_JP = '"Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, "メイリオ", sans-serif';

// MASTER SPECIFICATION #10/#32: Login/Registration等の認証画面はTeam Brand Screenではなく
// CIRCLE LINES Brand Screen。以前はteamName/logoUrlを受け取ってチームロゴを主役にする
// 表示も持っていたが、実際にどの呼び出し元からも使われていなかった(認証前でチームが
// 確定していないため)。既存呼び出し元は全てCIRCLE LINESブランド表示のみを使っている。
export function AuthHeading() {
  return (
    <div className="mb-10 text-center">
      {/*
        以前は /brand/circle-lines-icon.png(青い角丸四角のiOSアプリアイコンそのもの)を
        rounded-2xlで表示していたが、「タイルを置いた」印象になるため、角丸四角の枠を
        持たないロゴマーク単体(circle-lines-icon-512.pngから白マークを閾値付きで
        切り出し、ブランドNavy #123BDB で着色した透過PNG)に差し替えた。外接矩形で
        タイトにトリミング済みなので、正方形指定ではなく幅基準で高さautoにする。
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/circle-lines-logo.png" alt="CIRCLE LINES" className="w-36 h-auto mx-auto mb-4" />
      {/*
        以前はbackground-clip:textでグラデーション文字にしていたが、iPadOS標準の
        Safari(ホーム画面PWA以外でも再現)で、この画面のメールアドレス欄をタップした
        瞬間にSafari自体が落ちる不具合が報告された。position:fixedのコンテナ内で
        background-clip:textを使ったテキストが、フォーム欄フォーカス時のAutoFill
        UI表示に伴うレイアウト再計算のタイミングでWebKitのレンダリングプロセスごと
        クラッシュさせることがある既知の問題群と一致するため、認証系画面(ログイン・
        新規登録・招待・パスワード再設定等、全てAuthHeadingを共有)からは
        background-clip:textを撤去し、単色(--brand-navy)表示にした。
      */}
      <h1
        className="font-medium text-3xl tracking-wide"
        style={{ fontFamily: FONT_JP, color: BRAND_NAVY }}
      >
        CIRCLE LINES
      </h1>
      <div className="text-[10px] tracking-[0.3em] uppercase text-ink-soft mt-3" style={{ fontFamily: FONT_JP }}>
        Team Management Platform
      </div>
    </div>
  );
}
