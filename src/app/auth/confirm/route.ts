import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Supabaseのメール確認リンク(サインアップ確認・招待受諾)が最終的に到達するコールバック。
// URLの ?code= を実際のログインセッションに交換してからアプリ内に遷移させる。
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/schedule";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirm_failed`);
}
