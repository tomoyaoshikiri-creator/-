import type { ScheduleType } from "./database.types";

// 予定種別ごとの色。カレンダーの日付マスと種別タグ(TypeTag)で同じ色を使うための単一のソース。
// 練習=オレンジ(チームのアクセントカラー)、試合=赤(danger)、イベント=ライトブルー(sky、固定色)。
export function scheduleTypeColor(type: ScheduleType): "orange" | "danger" | "sky" {
  switch (type) {
    case "game":
      return "danger";
    case "event":
      return "sky";
    default:
      return "orange";
  }
}
