import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { TeamSport } from "@/lib/database.types";

// /auth/confirm でのセッション確立後、メール確認待ちの間保留していた
// 「チーム作成」または「招待受諾」のRPCをここで実行する。
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const kind = searchParams.get("kind");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  if (kind === "team") {
    const teamName = searchParams.get("teamName") ?? "";
    const adminName = searchParams.get("adminName") ?? "";
    const sport = (searchParams.get("sport") ?? "ミニバスケットボール") as TeamSport;
    const { error } = await supabase.rpc("create_team_and_admin", {
      team_name: teamName,
      admin_name: adminName,
      team_sport: sport,
    });
    if (error && !error.message.includes("既にチームに所属")) {
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    }
  } else if (kind === "invite") {
    const token = searchParams.get("token") ?? "";
    const name = searchParams.get("name") ?? "";
    const playerIds = (searchParams.get("playerIds") ?? "").split(",").filter((id) => id !== "");
    const { error } = await supabase.rpc("accept_invite", {
      invite_token: token,
      member_name: name,
      player_ids: playerIds,
    });
    if (error && !error.message.includes("既にチームに所属")) {
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    }
  }

  return NextResponse.redirect(`${origin}/schedule`);
}
