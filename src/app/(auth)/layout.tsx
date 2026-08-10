import { createClient } from "@/lib/supabase/server";
import { teamLogoUrl } from "@/lib/teamLogo";

export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug?: string }>;
}) {
  const { slug } = await params;

  let teamName: string | null = null;
  let logoUrl: string | null = null;
  if (slug) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_team_login_branding", { p_slug: slug });
    const branding = data?.[0];
    if (branding) {
      teamName = branding.name;
      logoUrl = teamLogoUrl(supabase, branding.logo_path);
    }
  }

  return (
    <div className="app-shell">
      <div className="flex-1 overflow-y-auto flex flex-col justify-center px-6 py-10">
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
              <div
                className="text-[10px] tracking-[0.3em] uppercase text-ink-soft mt-3"
                style={{ fontFamily: '"Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, "メイリオ", sans-serif' }}
              >
                Club Link
              </div>
              <div
                className="text-[10px] tracking-[0.3em] uppercase text-ink-soft"
                style={{ fontFamily: '"Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, "メイリオ", sans-serif' }}
              >
                Team Management Tools
              </div>
            </>
          ) : (
            <>
              <h1
                className="font-medium text-ink leading-[1.15]"
                style={{ fontFamily: '"Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, "メイリオ", sans-serif' }}
              >
                <span className="block text-4xl tracking-[0.2em]">Club</span>
                <span className="block text-4xl tracking-[0.2em]">Link</span>
              </h1>
              <div
                className="text-[10px] tracking-[0.3em] uppercase text-ink-soft mt-3"
                style={{ fontFamily: '"Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, "メイリオ", sans-serif' }}
              >
                Team Management Tools
              </div>
            </>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
