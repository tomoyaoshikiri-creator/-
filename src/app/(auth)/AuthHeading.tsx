const FONT_JP = '"Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, "メイリオ", sans-serif';

export function AuthHeading({
  teamName,
  logoUrl,
}: {
  teamName?: string | null;
  logoUrl?: string | null;
}) {
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
