import { NextResponse } from "next/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { recordAuditEvent } from "@/lib/auditLog";
import { parseCsv, stripBom } from "@/lib/csv";
import { PLAYER_IMPORT_MAX_BYTES, PLAYER_IMPORT_MAX_ROWS, parsePlayerImportCsv, validatePlayerImportRows } from "@/lib/playerImport";
import { hasBulkImportAccess } from "@/lib/plan";
import type { Database } from "@/lib/database.types";

export const dynamic = "force-dynamic";

// 選手のCSV一括登録(M-1、Maxプラン限定)。検証(列チェック・学年/ポジションの妥当性・
// 選手数上限・重複判定)はすべてこのサーバー側で行い、クライアントの申告は一切信用しない
// (dryRun=trueでも同じ検証ロジックを通し、プレビューと実登録の判定がズレないようにする)。
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.csvText !== "string" || typeof body.dryRun !== "boolean") {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }
  const { csvText, dryRun } = body as { csvText: string; dryRun: boolean };

  const byteLength = new TextEncoder().encode(csvText).length;
  if (byteLength > PLAYER_IMPORT_MAX_BYTES) {
    return NextResponse.json(
      { error: `ファイルサイズが大きすぎます(上限${(PLAYER_IMPORT_MAX_BYTES / 1024 / 1024).toFixed(0)}MB)` },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const [{ data: teamId }, { data: role }] = await Promise.all([
    supabase.rpc("current_team_id"),
    supabase.rpc("current_role"),
  ]);
  if (!teamId || (role !== "指導者" && role !== "管理者")) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { data: team } = await supabase.from("teams").select("plan, sport, category").eq("id", teamId).single();
  if (!team || !hasBulkImportAccess(team.plan)) {
    return NextResponse.json({ error: "このプランでは利用できません" }, { status: 403 });
  }

  const csvRows = parseCsv(stripBom(csvText));
  const dataRowCount = Math.max(0, csvRows.length - 1);
  if (dataRowCount > PLAYER_IMPORT_MAX_ROWS) {
    return NextResponse.json({ error: `行数が多すぎます(上限${PLAYER_IMPORT_MAX_ROWS}行)` }, { status: 400 });
  }

  const { headerError, rows } = parsePlayerImportCsv(csvRows);
  if (headerError) {
    return NextResponse.json({ error: headerError }, { status: 400 });
  }
  if (rows.length === 0) {
    return NextResponse.json({ error: "登録する行がありません" }, { status: 400 });
  }

  const { data: existingPlayers } = await supabase.from("players").select("sei, mei, birthday").eq("team_id", teamId);

  const results = validatePlayerImportRows({
    rows,
    category: team.category,
    sport: team.sport,
    existingPlayers: existingPlayers ?? [],
  });
  const validRows = results.filter((r) => r.parsed);
  const summary = { total: results.length, validCount: validRows.length, errorCount: results.length - validRows.length };

  if (dryRun) {
    return NextResponse.json({ dryRun: true, results, ...summary });
  }

  let insertedCount = 0;
  if (validRows.length > 0) {
    const { data: inserted, error } = await supabase
      .from("players")
      .insert(
        validRows.map((r) => ({
          team_id: teamId,
          sei: r.parsed!.sei,
          mei: r.parsed!.mei,
          sei_kana: r.parsed!.sei_kana,
          mei_kana: r.parsed!.mei_kana,
          grade: r.parsed!.grade,
          number: r.parsed!.number,
          positions: r.parsed!.positions,
          birthday: r.parsed!.birthday,
        })),
      )
      .select("id");
    if (error) {
      return NextResponse.json({ error: `登録に失敗しました: ${error.message}` }, { status: 500 });
    }
    insertedCount = inserted?.length ?? 0;
  }

  // 監査ログには件数のみを記録し、選手名は含めない(detailは個人情報を持たせない方針)。
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRoleKey) {
    const adminClient = createSupabaseJsClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await recordAuditEvent(adminClient, {
      teamId,
      actorId: user.id,
      action: "players_bulk_imported",
      detail: { total: summary.total, imported: insertedCount },
    });
  }

  return NextResponse.json({ dryRun: false, results, ...summary, insertedCount });
}
