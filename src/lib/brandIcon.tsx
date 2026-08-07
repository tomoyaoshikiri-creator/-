import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { teamLogoUrl } from "@/lib/teamLogo";

export function BrandIconMark({ size }: { size: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#22201c",
        color: "#faf8f3",
        fontFamily: "Georgia, serif",
        fontWeight: 600,
        fontSize: Math.round(size * 0.42),
        letterSpacing: -Math.round(size * 0.02),
      }}
    >
      CL
    </div>
  );
}

// このデプロイは今のところ都賀ビクトリーズ1チーム専用の運用のため、
// アップロード済みのチームロゴがあればホーム画面アイコンにもそれを使う。
// 複数チームが本格的に混在するようになったら、この関数は見直すこと。
export async function renderAppIcon(size: number): Promise<Response> {
  try {
    const supabase = await createClient();
    const { data: logoPath } = await supabase.rpc("get_default_team_logo_path");
    if (logoPath) {
      const url = teamLogoUrl(supabase, logoPath);
      if (url) {
        const res = await fetch(url);
        if (res.ok) {
          const buffer = await res.arrayBuffer();
          const contentType = res.headers.get("content-type") ?? "image/png";
          return new Response(buffer, { headers: { "content-type": contentType } });
        }
      }
    }
  } catch {
    // 取得に失敗した場合は下のフォールバックを使う
  }

  return new ImageResponse(<BrandIconMark size={size} />, { width: size, height: size });
}
