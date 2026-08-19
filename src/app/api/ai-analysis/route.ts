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
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// 1チームあたりの月間生成回数上限(選手個人分析・チーム分析を合算、暴発防止のレート制限)。
// カウント自体はsupabase/migrations/0102_ai_analysis_usage.sqlのai_analysis_usageテーブル+
// RPC(reserve_ai_analysis_usage/resolve_ai_analysis_usage/get_ai_analysis_usage)で、
// team_id+当月(JST基準)を単位にアトミックに管理する。player_analysis_notes/
// team_analysis_notes(分析結果の保存先)はカウントに使わない。
const MONTHLY_LIMIT = 50;

async function resolveUsage(
  supabase: SupabaseClient<Database>,
  reservationId: string,
  succeeded: boolean,
) {
  const { error } = await supabase.rpc("resolve_ai_analysis_usage", {
    p_reservation_id: reservationId,
    p_succeeded: succeeded,
  });
  if (error) console.error("[api/ai-analysis] failed to resolve usage reservation", error);
}

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
  const { scope, playerId, fiscalYear: requestedFiscalYear, requestId } = await request.json();
  if (scope !== "player" && scope !== "team") {
    return NextResponse.json({ error: "scope は player または team を指定してください" }, { status: 400 });
  }
  if (scope === "player" && !playerId) {
    return NextResponse.json({ error: "playerId が必要です" }, { status: 400 });
  }
  // requestIdはクライアントが生成する冪等キー(同一操作の再送で二重にカウントしない
  // ため)。未指定でも動作は継続できるよう、サーバー側でフォールバック生成する。
  const usageRequestId: string = typeof requestId === "string" && requestId ? requestId : crypto.randomUUID();

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

  // チーム単位(選手分析+チーム分析を合算)で当月の1枠をアトミックに予約する。
  // 上限に達している場合はAI_USAGE_LIMIT_REACHEDで拒否され、Anthropic API自体を
  // 呼び出さない。同一requestIdでの再送は新たな予約を作らず、既存の予約/確定結果を返す。
  const { data: reservation, error: reserveError } = await supabase.rpc("reserve_ai_analysis_usage", {
    p_request_id: usageRequestId,
    p_monthly_limit: MONTHLY_LIMIT,
  });
  if (reserveError) {
    if (reserveError.message.includes("AI_USAGE_LIMIT_REACHED")) {
      return NextResponse.json(
        { error: `今月のAI分析利用上限(${MONTHLY_LIMIT}回、チーム全体で合算)に達しました。翌月1日から再び利用できます。` },
        { status: 429 },
      );
    }
    console.error("[api/ai-analysis] failed to reserve usage", reserveError);
    return NextResponse.json({ error: "AI分析の生成に失敗しました" }, { status: 500 });
  }
  const usage = reservation?.[0];
  if (!usage) {
    return NextResponse.json({ error: "AI分析の生成に失敗しました" }, { status: 500 });
  }
  if (usage.usage_status !== "reserved") {
    // 同一requestIdの再送で、前回既に成功/失敗として確定済み。二重生成を避けて
    // そのまま結果を返す(再度Anthropicを呼び出さない)。
    return NextResponse.json(
      usage.usage_status === "succeeded"
        ? { alreadyProcessed: true, usedThisMonth: usage.used_count, monthlyLimit: MONTHLY_LIMIT }
        : { error: "この操作は既に処理されています。もう一度お試しください。" },
      { status: usage.usage_status === "succeeded" ? 200 : 409 },
    );
  }
  const reservationId = usage.reservation_id;

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
    await resolveUsage(supabase, reservationId, false);
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
    await resolveUsage(supabase, reservationId, false);
    return NextResponse.json({ error: "AI分析の生成に失敗しました" }, { status: 502 });
  }
  if (!body) {
    await resolveUsage(supabase, reservationId, false);
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
    await resolveUsage(supabase, reservationId, false);
    return NextResponse.json({ error: "AI分析の保存に失敗しました" }, { status: 500 });
  }

  await resolveUsage(supabase, reservationId, true);

  return NextResponse.json({ body, usedThisMonth: usage.used_count, monthlyLimit: MONTHLY_LIMIT });
}

// 選手カルテ・チームカルテのAI分析ボタン表示時に、今月の利用状況(◯/50回、チーム全体で
// 選手分析・チーム分析を合算)を生成せずに確認するためのエンドポイント。どの画面
// (選手カルテ/チームカルテ)から呼んでも同じteam_idなら同じ値を返す。
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

  const { data: usedThisMonth, error } = await supabase.rpc("get_ai_analysis_usage");
  if (error) {
    console.error("[api/ai-analysis] failed to get usage", error);
    return NextResponse.json({ error: "利用状況の取得に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ usedThisMonth: usedThisMonth ?? 0, monthlyLimit: MONTHLY_LIMIT });
}
