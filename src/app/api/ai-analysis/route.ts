import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { hasAiAnalysisAccess } from "@/lib/plan";

// 1チームあたりの1日の生成回数上限(暴発防止のレート制限)。
const DAILY_LIMIT = 20;

const SYSTEM_PROMPT =
  "あなたはユーススポーツチームのデータ分析アシスタントです。指導者がそのまま選手や保護者に共有できるよう、日本語で簡潔に分析結果をまとめてください。";

// 選手カルテ・チームカルテの「分析用抽出」で使っている既存のテキスト整形関数
// (buildKarteAnalysisText/buildTeamKarteAnalysisText)の出力をそのまま受け取り、
// Anthropic APIに渡して分析コメントを生成する。生成結果は選手分析フィードバック/
// チーム分析フィードバックにsource:'ai'として追記し、レート制限もこの2テーブルの
// 当日のAI生成件数を数えるだけで実現する(別途カウンタテーブルは設けない)。
export async function POST(request: Request) {
  const { scope, playerId, dataText } = await request.json();
  if (scope !== "player" && scope !== "team") {
    return NextResponse.json({ error: "scope は player または team を指定してください" }, { status: 400 });
  }
  if (scope === "player" && !playerId) {
    return NextResponse.json({ error: "playerId が必要です" }, { status: 400 });
  }
  if (!dataText) {
    return NextResponse.json({ error: "dataText が必要です" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("role, team_id").eq("id", user.id).single();
  if (!profile || profile.role !== "管理者") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { data: team } = await supabase.from("teams").select("plan").eq("id", profile.team_id).single();
  if (!team || !hasAiAnalysisAccess(team.plan)) {
    return NextResponse.json({ error: "このプランではAI分析を利用できません" }, { status: 403 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI分析機能が未設定です" }, { status: 500 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const [{ count: playerCount }, { count: teamCount }] = await Promise.all([
    supabase
      .from("player_analysis_notes")
      .select("id", { count: "exact", head: true })
      .eq("team_id", profile.team_id)
      .eq("source", "ai")
      .gte("created_at", todayStart.toISOString()),
    supabase
      .from("team_analysis_notes")
      .select("id", { count: "exact", head: true })
      .eq("team_id", profile.team_id)
      .eq("source", "ai")
      .gte("created_at", todayStart.toISOString()),
  ]);
  if ((playerCount ?? 0) + (teamCount ?? 0) >= DAILY_LIMIT) {
    return NextResponse.json(
      { error: `本日のAI分析の上限(${DAILY_LIMIT}回)に達しました。明日また試してください。` },
      { status: 429 },
    );
  }

  const anthropic = new Anthropic({ apiKey });
  let body: string;
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: dataText }],
    });
    body = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
  } catch (err) {
    console.error("[api/ai-analysis] Anthropic call failed", err);
    return NextResponse.json({ error: "AI分析の生成に失敗しました" }, { status: 502 });
  }
  if (!body) {
    return NextResponse.json({ error: "AI分析の生成に失敗しました" }, { status: 502 });
  }

  const { error: insertError } =
    scope === "player"
      ? await supabase
          .from("player_analysis_notes")
          .insert({ team_id: profile.team_id, player_id: playerId, author_id: user.id, body, source: "ai" })
      : await supabase
          .from("team_analysis_notes")
          .insert({ team_id: profile.team_id, author_id: user.id, body, source: "ai" });
  if (insertError) {
    console.error("[api/ai-analysis] failed to save result", insertError);
    return NextResponse.json({ error: "AI分析の保存に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ body });
}
