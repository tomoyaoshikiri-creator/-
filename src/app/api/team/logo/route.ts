import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { detectImageMimeType, extensionForImageMimeType } from "@/lib/imageSniff";

export const dynamic = "force-dynamic";

const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024; // 5MiB

// チームロゴのアップロードをRoute Handler経由にし、クライアント側の accept 属性頼み
// (拡張子・ブラウザ申告のContent-Type頼み)だった検証を、サーバー側のマジックバイト判定に
// 置き換える(A-9)。PNG/JPEG/WebPのみを許可し、SVGは受け付けない(SVGはテキストベースの
// XMLでスクリプトを埋め込めるため、ロゴのようにチーム外のユーザーにも配信される画像としては
// XSSベクターになりうる)。
//
// アップロード先(Storage)・teams.logo_pathの更新権限は、既存のRLSポリシー
// (team_logos_storage_*、0003)がチームの管理者に限定しているため、ここでは
// service_roleへの昇格は行わずリクエストスコープのクライアントをそのまま使う。
export async function POST(request: Request) {
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
  if (!teamId || role !== "管理者") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "ファイルが選択されていません" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "空のファイルです" }, { status: 400 });
  }
  if (file.size > MAX_LOGO_SIZE_BYTES) {
    return NextResponse.json(
      { error: `ファイルサイズは${MAX_LOGO_SIZE_BYTES / (1024 * 1024)}MB以下にしてください` },
      { status: 400 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = detectImageMimeType(bytes);
  if (!mimeType) {
    return NextResponse.json({ error: "PNG・JPEG・WebP形式の画像のみアップロードできます" }, { status: 400 });
  }

  const path = `${teamId}/logo-${Date.now()}.${extensionForImageMimeType(mimeType)}`;
  const { error: uploadError } = await supabase.storage
    .from("team-logos")
    .upload(path, bytes, { contentType: mimeType, upsert: false });
  if (uploadError) {
    return NextResponse.json({ error: `アップロードに失敗しました: ${uploadError.message}` }, { status: 500 });
  }

  const { error: updateError } = await supabase.from("teams").update({ logo_path: path }).eq("id", teamId);
  if (updateError) {
    return NextResponse.json({ error: `保存に失敗しました: ${updateError.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, path });
}
