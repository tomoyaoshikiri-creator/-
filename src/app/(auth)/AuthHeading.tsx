const FONT_JP = '"Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, "メイリオ", sans-serif';

// CIRCLE LINESブランドグラデーション(Navy → Blue → Cyan)。src/lib/theme.tsのBRAND_NAVY/
// BRAND_BLUE/BRAND_CYANと同じ値。ログイン画面はサービスブランドの表示領域のため、
// (この時点でチームがまだ確定していない=teamThemeStyle()によるCSS変数上書きの対象外という
// 事情もあり)ここでは固定値としてそのまま使う。
const BRAND_GRADIENT = "linear-gradient(135deg, #123BDB 0%, #087CF0 55%, #08C6E8 100%)";

export function AuthHeading({
  teamName,
  logoUrl,
  brand,
}: {
  teamName?: string | null;
  logoUrl?: string | null;
  // "circleLines": ログイン画面向け。チームロゴではなくCIRCLE LINES公式ブランドアイコン/
  // ブランドカラーを表示する(Phase UI-2A: サービスブランドとチームブランドの分離)。
  // 未指定時は従来通り(teamNameの有無で分岐する既存の挙動を維持、ログイン以外の
  // 画面には影響しない)。
  brand?: "circleLines";
}) {
  if (brand === "circleLines") {
    return (
      <div className="mb-10 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/circle-lines-icon.png"
          alt="CIRCLE LINES"
          className="w-16 h-16 mx-auto mb-4 rounded-2xl"
        />
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

  return (
    <div className="mb-10 text-center">
      {teamName ? (
        <>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="w-14 h-14 mx-auto mb-3 rounded-xl object-contain bg-white border border-line"
            />
          )}
          <h1 className="font-medium text-ink text-2xl leading-tight break-words">{teamName}</h1>
          <div className="text-[10px] tracking-[0.3em] uppercase text-ink-soft mt-3" style={{ fontFamily: FONT_JP }}>
            Club Link
          </div>
          <div className="text-[10px] tracking-[0.3em] uppercase text-ink-soft" style={{ fontFamily: FONT_JP }}>
            Team Management Tools
          </div>
        </>
      ) : (
        <>
          <h1 className="font-medium text-ink leading-[1.15] uppercase" style={{ fontFamily: FONT_JP }}>
            <span className="block text-4xl tracking-[0.2em]">Club</span>
            <span className="block text-4xl tracking-[0.2em]">Link</span>
          </h1>
          <div className="text-[10px] tracking-[0.3em] uppercase text-ink-soft mt-3" style={{ fontFamily: FONT_JP }}>
            Team Management Tools
          </div>
        </>
      )}
    </div>
  );
}
