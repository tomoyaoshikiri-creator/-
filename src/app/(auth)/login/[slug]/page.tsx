import { createClient } from "@/lib/supabase/server";
import { teamLogoUrl } from "@/lib/teamLogo";
import { AuthHeading } from "../../AuthHeading";
import { LoginForm } from "../LoginForm";

export default async function TeamLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { slug } = await params;
  const { error, notice } = await searchParams;

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_team_login_branding", { p_slug: slug });
  const branding = data?.[0];

  return (
    <div>
      <AuthHeading teamName={branding?.name} logoUrl={teamLogoUrl(supabase, branding?.logo_path ?? null)} />
      {error && (
        <div className="mb-3 text-[12.5px] text-danger text-center bg-white border border-line rounded-2xl p-3">
          {error === "confirm_failed" ? "確認リンクが無効か期限切れです。もう一度お試しください。" : error}
        </div>
      )}
      {notice === "inactivity" && (
        <div className="mb-3 text-[12.5px] text-ink-soft text-center bg-white border border-line rounded-2xl p-3 text-pretty">
          しばらく操作がなかったため、自動的にログアウトしました。
          <br />
          もう一度ログインしてください。
        </div>
      )}
      <LoginForm />
    </div>
  );
}
