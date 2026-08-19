import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { hasAiAnalysisAccess } from "@/lib/plan";
import { AI_ANALYSIS_MODEL, AI_ANALYSIS_MAX_TOKENS } from "@/lib/ai/model";
import { planKindFor } from "@/lib/ai/types";
import { hasSportContext } from "@/lib/ai/sports";
import { collectPlayerAnalysisData, collectTeamAnalysisData } from "@/lib/ai/collect";
import { buildPlayerAnalysisPrompt, buildTeamAnalysisPrompt } from "@/lib/ai/buildPrompt";
import { fiscalYearOf, todayDateStr } from "@/lib/format";

// 1チームあたりの月間生成回数上限(暴発防止のレート制限)。当月1日0時を起点に
// created_atで数えるだけで実現し、物理的な月次リセット処理は不要にしている
// (todayDateStr()と同じくJST厳密ではなくサーバーのローカル日時を基準にする簡略実装)。
const MONTHLY_LIMIT = 50;

// AI分析用のデータ収集(collectPlayerAnalysisData/collectTeamAnalysisData)・プロンプト構築
// (buildPlayerAnalysisPrompt/buildTeamAnalysisPrompt、COMMON+PLAN+SPORT+ANALYSIS_TYPE+
// DATA_QUALITY+ACTUAL_DATAの動的構築)はすべてsrc/lib/ai/以下に分離している。
// このルートはサーバー側で権限・プラン・レート制限を確認したうえでその2つを呼び出し、
// Anthropic APIへ渡して結果を選手分析フィードバック/チーム分析フィードバックに
// source:'ai'として保存するだけの薄い層にする。
//
// (旧実装との違い) 以前はクライアント側で「分析用抽出」と同じテキスト整形関数を使って
// dataTextを作りAPIへ送っていたが、これだと競技・プランに応じた分析の出し分けができず、
// クライアントが任意のテキストを送れてしまう構造でもあった。今回からデータ収集自体を
// サーバー側(このAPI)で行い、クライアントはscope/playerId/fiscalYearだけを送る。
export async function POST(request: Request) {
  const { scope, playerId, fiscalYear: requestedFiscalYear } = await request.json();
  if (scope !== "player" && scope !== "team") {
    return NextResponse.json({ error: "scope は player または team を指定してください" }, { status: 400 });
  }
  if (scope === "player" && !playerId) {
    return NextResponse.json({ error: "playerId が必要です" }, { status: 400 });
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

  const { data: team } = await supabase.from("teams").select("plan, sport").eq("id", profile.team_id).single();
  if (!team || !hasAiAnalysisAccess(team.plan)) {
    return NextResponse.json({ error: "このプランではAI分析を利用できません" }, { status: 403 });
  }
  const planKind = planKindFor(team.plan);
  if (!planKind) {
    return NextResponse.json({ error: "このプランではAI分析を利用できません" }, { status: 403 });
  }
  if (!hasSportContext(team.sport)) {
    return NextResponse.json({ error: "この競技のAI分析機能は現在準備中です" }, { status: 501 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI分析機能が未設定です" }, { status: 500 });
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [{ count: playerCount }, { count: teamCount }] = await Promise.all([
    supabase
      .from("player_analysis_notes")
      .select("id", { count: "exact", head: true })
      .eq("team_id", profile.team_id)
      .eq("source", "ai")
      .gte("created_at", monthStart.toISOString()),
    supabase
      .from("team_analysis_notes")
      .select("id", { count: "exact", head: true })
      .eq("team_id", profile.team_id)
      .eq("source", "ai")
      .gte("created_at", monthStart.toISOString()),
  ]);
  const usedThisMonth = (playerCount ?? 0) + (teamCount ?? 0);
  if (usedThisMonth >= MONTHLY_LIMIT) {
    return NextResponse.json(
      { error: `今月のAI分析利用上限(${MONTHLY_LIMIT}回)に達しました。翌月1日から再び利用できます。` },
      { status: 429 },
    );
  }

  const fiscalYear =
    typeof requestedFiscalYear === "number" && Number.isInteger(requestedFiscalYear)
      ? requestedFiscalYear
      : fiscalYearOf(todayDateStr());

  let system: string;
  let userContent: string;
  try {
    if (scope === "player") {
      const data = await collectPlayerAnalysisData(supabase, { playerId, fiscalYear, sport: team.sport, planKind });
      ({ system, user: userContent } = buildPlayerAnalysisPrompt(data));
    } else {
      const data = await collectTeamAnalysisData(supabase, { fiscalYear, sport: team.sport, planKind });
      ({ system, user: userContent } = buildTeamAnalysisPrompt(data));
    }
  } catch (err) {
    console.error("[api/ai-analysis] failed to collect analysis data", err);
    return NextResponse.json({ error: "分析用データの取得に失敗しました" }, { status: 500 });
  }

  const anthropic = new Anthropic({ apiKey });
  let body: string;
  try {
    const response = await anthropic.messages.create({
      model: AI_ANALYSIS_MODEL,
      max_tokens: AI_ANALYSIS_MAX_TOKENS,
      system,
      messages: [{ role: "user", content: userContent }],
    });
    body = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    // 品質確認・コスト管理用。個人情報(選手名・チーム名・本文)は含めない。
    // stop_reasonが"max_tokens"の場合、出力が途中で打ち切られている可能性がある。
    console.log("[api/ai-analysis] usage", {
      scope,
      model: response.model,
      stopReason: response.stop_reason,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });
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

  return NextResponse.json({ body, usedThisMonth: usedThisMonth + 1, monthlyLimit: MONTHLY_LIMIT });
}

// 選手カルテ・チームカルテのAI分析ボタン表示時に、今月の利用状況(◯/50回)を
// 生成せずに確認するためのエンドポイント。
export async function GET() {
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

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [{ count: playerCount }, { count: teamCount }] = await Promise.all([
    supabase
      .from("player_analysis_notes")
      .select("id", { count: "exact", head: true })
      .eq("team_id", profile.team_id)
      .eq("source", "ai")
      .gte("created_at", monthStart.toISOString()),
    supabase
      .from("team_analysis_notes")
      .select("id", { count: "exact", head: true })
      .eq("team_id", profile.team_id)
      .eq("source", "ai")
      .gte("created_at", monthStart.toISOString()),
  ]);

  return NextResponse.json({ usedThisMonth: (playerCount ?? 0) + (teamCount ?? 0), monthlyLimit: MONTHLY_LIMIT });
}
