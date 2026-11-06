import type { Notice, Schedule } from "@/lib/database.types";

// NEWS機能拡張(表示対象年月・関連予定)の純粋ロジックをまとめる。UIコンポーネント
// (NewNoticeModal.tsx / notice/[id]/page.tsx / notice/page.tsx)からDB呼び出しを
// 挟まず再利用・テストできるよう、副作用なしの関数として切り出す。

// 保存時のサーバー側検証(マイグレーション20261106120000のトリガー/FK)に引っかかった
// 場合の判別。予定が保存直前に削除された(FK違反、23503)か、他チームの予定に
// 差し替わっていた(このNEWS専用トリガーの例外、判別用プレフィックス付き)かのどちらか。
export function isRelatedScheduleError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "23503" || Boolean(error.message?.includes("RELATED_SCHEDULE_INVALID"));
}

// 確定仕様3: 予定を選択した際、表示対象年月を自動反映すべきかどうかを判定する。
// 「初めて予定を選択した際、ユーザーが年月を手動変更していなければ予定の開催月を
// 反映する」「一度でも手動変更した場合は手動設定を優先する」「関連予定の変更では
// 表示対象年月を変更しない」をこの1関数にまとめる。
// 戻り値: 自動反映すべき新しい年月("YYYY-MM")、不要ならnull。
export function resolveAutoFillMonth({
  prevRelatedScheduleId,
  manuallyChangedMonth,
  newSchedule,
}: {
  prevRelatedScheduleId: string | null;
  manuallyChangedMonth: boolean;
  newSchedule: Schedule | null;
}): string | null {
  const isFirstSelection = prevRelatedScheduleId === null && newSchedule !== null;
  if (!isFirstSelection || manuallyChangedMonth) return null;
  return newSchedule!.date.slice(0, 7);
}

// 確定仕様5: NEWS一覧を3グループに分けて並べ替える。
// ①本日以降の関連予定があるNEWS(開催日昇順→NEWS登録日時降順)
// ②関連予定のないNEWS、または開催日未設定の関連予定があるNEWS(登録日時降順)
// ③過去の関連予定があるNEWS(開催日降順→NEWS登録日時降順)
// 同条件の最終タイブレークはID。ソートにはNEWSの表示対象年月ではなく関連予定の
// 開催日を使う(呼び出し側で既にdisplay_year_monthによる月の絞り込みは済んでいる前提)。
export function groupOfNotice(
  notice: Pick<Notice, "related_schedule_id">,
  schedulesById: Record<string, Pick<Schedule, "date">>,
  today: string,
): 1 | 2 | 3 {
  const sched = notice.related_schedule_id ? schedulesById[notice.related_schedule_id] : undefined;
  if (!sched || !sched.date) return 2;
  return sched.date >= today ? 1 : 3;
}

export function sortNoticesByRelatedSchedule<T extends Pick<Notice, "id" | "related_schedule_id" | "created_at">>(
  notices: T[],
  schedulesById: Record<string, Pick<Schedule, "date">>,
  today: string,
): T[] {
  return [...notices].sort((a, b) => {
    const ga = groupOfNotice(a, schedulesById, today);
    const gb = groupOfNotice(b, schedulesById, today);
    if (ga !== gb) return ga - gb;
    if (ga !== 2) {
      const sa = schedulesById[a.related_schedule_id!]!.date;
      const sb = schedulesById[b.related_schedule_id!]!.date;
      if (sa !== sb) return ga === 1 ? (sa < sb ? -1 : 1) : sa < sb ? 1 : -1;
    }
    if (a.created_at !== b.created_at) return a.created_at > b.created_at ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

// NEWS一覧のカーソルページング(関連予定あり/なしの両方)が使う、
// created_at降順・id昇順の安定順序における「cursor行より後ろ」を表す
// PostgRESTのor()条件文字列。created_atだけをカーソルにすると、同じcreated_at
// (完全に同時刻)のNEWSが複数ある場合にページ境界でその行群を丸ごと
// 取りこぼす恐れがあるため、idを複合キーとして使う(確定仕様の最終タイブレークと
// 同じ並び)。
export function afterNoticeCursor(createdAt: string, id: string): string {
  return `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.gt.${id})`;
}

export type NoticeCursor = { createdAt: string; id: string };

// SupabaseクエリのPostgrestResponseと同じ形(成功ならdataに配列・errorはnull、
// 失敗ならdataはnull・errorに値)の判別可能なUnion。fetchAllPagesByCursorは
// これを見て「正常な0件」と「取得失敗」を区別する(data ?? []で丸めてしまうと、
// 取得失敗が0件として扱われてしまう)。
export type PageFetchResult<T> = { data: T[]; error: null } | { data: null; error: unknown };

// created_at降順・id昇順でページングされたデータを、複合カーソルを使って
// 尽きるまで取得する汎用ループ。fetchPageの実際のクエリ構築(PostgREST/Supabase)
// は呼び出し側に委ね、ここでは「ページが尽きるまでカーソルを進める」という
// 取りこぼし・重複のないページング手順そのものをテスト可能な形で切り出す。
//
// いずれかのページ取得でerrorが返った場合、その時点で直ちに打ち切り
// { data: null, error } を返す(それまでに取得できていた分も正常終了や0件とは
// 扱わない。3グループソートは全件が揃っている前提のため、一部だけのデータで
// 「取得できた分」として表示すると、並び順自体が不正確になりかねないため)。
export async function fetchAllPagesByCursor<T extends { created_at: string; id: string }>(
  fetchPage: (cursor: NoticeCursor | null) => Promise<PageFetchResult<T>>,
  batchSize: number,
): Promise<PageFetchResult<T>> {
  const all: T[] = [];
  let cursor: NoticeCursor | null = null;
  for (;;) {
    const { data, error } = await fetchPage(cursor);
    if (error) return { data: null, error };
    const batch = data ?? [];
    all.push(...batch);
    if (batch.length < batchSize) break;
    const last = batch[batch.length - 1];
    cursor = { createdAt: last.created_at, id: last.id };
  }
  return { data: all, error: null };
}

// 添付・リアクション・関連予定など、NEWSのID一覧に対するin()問い合わせ用に
// IDをchunkSizeずつの配列へ分割する。1回のクエリに含めるID数を抑えることで、
// 大量取得時(本修正で関連予定ありNEWSの件数上限を撤廃したため、紐づく
// 添付・リアクション等の対象ID数も比例して増えうる)でもURL長やレスポンス
// サイズが際限なく膨らまないようにする。
export function chunkIds(ids: string[], chunkSize: number): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    chunks.push(ids.slice(i, i + chunkSize));
  }
  return chunks;
}
