import { brandGradientStops, gradientCss } from "@/lib/theme";

const FONT_JP = '"Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, "メイリオ", sans-serif';

// AppHeaderと同じCIRCLE LINES公式ブランドグラデーション(105deg, Navy 0% / Blue 40% / Cyan
// 100%)。ログイン等の認証画面はチームがまだ確定していない(teamThemeStyle()による
// CSS変数上書きの対象外)ため、src/lib/theme.tsの値をそのまま使い、Header側と常に
// 同じ値になるようにする(以前はここだけ別の角度・stop位置をハードコードしていた)。
const BRAND_GRADIENT = gradientCss(brandGradientStops());

// MASTER SPECIFICATION #10/#32: Login/Registration等の認証画面はTeam Brand Screenではなく
// CIRCLE LINES Brand Screen。以前はteamName/logoUrlを受け取ってチームロゴを主役にする
// 表示も持っていたが、実際にどの呼び出し元からも使われていなかった(認証前でチームが
// 確定していないため)。既存呼び出し元は全てCIRCLE LINESブランド表示のみを使っている。
export function AuthHeading() {
  return (
    <div className="mb-10 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/circle-lines-icon.png" alt="CIRCLE LINES" className="w-16 h-16 mx-auto mb-4 rounded-lg" />
      <h1
        className="font-medium text-3xl tracking-wide"
        style={{
          fontFamily: FONT_JP,
          backgroundImage: BRAND_GRADIENT,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        CIRCLE LINES
      </h1>
      <div className="text-[10px] tracking-[0.3em] uppercase text-ink-soft mt-3" style={{ fontFamily: FONT_JP }}>
        Team Management Platform
      </div>
    </div>
  );
}
