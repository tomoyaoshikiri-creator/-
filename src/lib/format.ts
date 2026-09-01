import type { TeamCategory, TeamPlan } from "@/lib/database.types";
import { GRADUATION_GRADE_BY_CATEGORY, MIN_GRADE_BY_CATEGORY } from "@/lib/category";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

// 内部の管理・DB上の値(お試し/中間/フル)は変えず、ユーザー向けの表示名だけ
// Free/Standard/Proにする。
export const PLAN_DISPLAY_LABELS: Record<TeamPlan, string> = {
  お試し: "Free",
  中間: "Standard",
  フル: "Pro",
  フルプラス: "Pro AI Plus",
  Max: "Max",
  max_partner: "Max Partner",
  signature_edition: "Signature Edition",
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)}${units[unitIndex]}`;
}

export function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
}

export function formatFullDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAYS[d.getDay()]})`;
}

// "YYYY-MM-DD"の日付文字列・ISOタイムスタンプのどちらでも先頭の年月を取り出せる。
export function monthLabel(dateStr: string): string {
  const [y, m] = dateStr.split("-");
  return `${y}年${Number(m)}月`;
}

// 日付の新しい順に並んだ一覧を、年月ごとのグループに分ける(グループ内の順序は維持される)。
export function groupByMonth<T>(items: T[], dateOf: (item: T) => string): { key: string; label: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = dateOf(item).slice(0, 7);
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return Array.from(map.entries()).map(([key, groupItems]) => ({
    key,
    label: monthLabel(key),
    items: groupItems,
  }));
}

// "YYYY-MM"形式の年月。お知らせ・日報・コーチノートなどの月別表示の基準値に使う。
export function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftYearMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// "YYYY-MM"を、その月の1日から翌月1日まで([start, end))のSupabaseクエリ用範囲に変換する。
export function monthRangeBounds(yearMonth: string): { start: string; end: string } {
  const [y, m] = yearMonth.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const next = new Date(y, m, 1);
  const end = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
  return { start, end };
}

export function formatSlashDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
}

// ISOタイムスタンプ(timestamptz)を、日付+時刻のラベルに整形する。
// メンバー一覧の「最終操作日時」など、日付だけでなく時刻も必要な箇所専用。
export function formatDateTimeLabel(isoStr: string): string {
  const d = new Date(isoStr);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]}) ${hh}:${mm}`;
}

export function formatTodayLabel(): string {
  const d = new Date();
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 「直近N日」のような閲覧範囲制限(お試しプランの日報30日制限など)の起点日を計算する。
export function dateDaysAgoStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 4月始まりの年度(例: 2026-01-12は2025年度)を日付文字列から算出する。
export function fiscalYearOf(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00");
  const y = d.getFullYear();
  return d.getMonth() + 1 >= 4 ? y : y - 1;
}

export function fiscalYearLabel(year: number): string {
  return `${year}年度`;
}

// 予定に手動で年度が固定されている場合はそちらを優先し、無ければ日付から自動判定する。
// 新チーム発足など、実態が4月始まりの年度と一致しないケースに対応するため。
export function effectiveFiscalYear(dateStr: string, override: number | null | undefined): number {
  return override ?? fiscalYearOf(dateStr);
}

export function scheduleMeta(s: {
  date: string;
  start_time: string | null;
  end_time: string | null;
  place: string | null;
}): string {
  const dateLabel = formatDateLabel(s.date);
  let timeLabel = "";
  if (s.start_time && s.end_time) timeLabel = ` ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`;
  else if (s.start_time) timeLabel = ` ${s.start_time.slice(0, 5)}〜`;
  const placeLabel = s.place ? ` @ ${s.place}` : "";
  return `${dateLabel}${timeLabel}${placeLabel}`;
}

export function playerFullName(p: { sei: string; mei: string }): string {
  return `${p.sei} ${p.mei}`.trim();
}

// カテゴリー内の相対学年に付ける接頭辞(小学生は既存の表示を変えないため接頭辞なし)。
const GRADE_CATEGORY_PREFIX: Partial<Record<TeamCategory, string>> = {
  中学生: "中学",
  高校生: "高校",
  大学生: "大学",
};

export function gradeLabel(grade: string | null, category: TeamCategory): string {
  if (category === "小学生") {
    // 既存チーム(都賀ビクトリーズ)の表示を変えないため、この分岐は変更しない。
    if (grade === "0") return "未就学";
    if (grade === null || grade === "") return "学年未設定";
    return `${grade}年生`;
  }
  const min = MIN_GRADE_BY_CATEGORY[category];
  const g = grade !== null ? parseInt(grade, 10) : NaN;
  if (min === null || isNaN(g)) return "学年未設定";
  const relative = g - min + 1;
  if (relative < 1) return "学年未設定";
  return `${GRADE_CATEGORY_PREFIX[category] ?? ""}${relative}年生`;
}

// 予定の対象学年(target_grade_min、nullなら全員)に選手が含まれるかどうかを判定する。
// grade/target_grade_minは同じ絶対値スケール上の数値のため、カテゴリーを問わず
// 単純な数値比較で判定できる。
export function isTargetEligible(playerGrade: string | null, targetGradeMin: string | null): boolean {
  if (targetGradeMin === null) return true;
  const g = playerGrade !== null ? parseInt(playerGrade, 10) : NaN;
  const min = parseInt(targetGradeMin, 10);
  return !isNaN(g) && g >= min;
}

export function obogCohortLabel(grade: string | null, category: TeamCategory): string {
  const graduationGrade = GRADUATION_GRADE_BY_CATEGORY[category];
  const g = grade !== null ? parseInt(grade, 10) : NaN;
  if (graduationGrade === null || isNaN(g) || g < graduationGrade) return "卒団年次不明";
  const years = g - graduationGrade;
  return years === 0 ? "卒団したて" : `卒団${years}年目`;
}

// gradeはOB・OG化した年に卒業学年のまま固定され、以後advance_academic_yearが実行される
// たびに+1される(卒団からの経過年数)。よって現在の年度から逆算すると、実際に卒団した
// 年度(卒業学年として過ごした最後の年度)が求まる。
export function obogGraduationFiscalYear(grade: string | null, category: TeamCategory, currentFiscalYear: number): number | null {
  const graduationGrade = GRADUATION_GRADE_BY_CATEGORY[category];
  const g = grade !== null ? parseInt(grade, 10) : NaN;
  if (graduationGrade === null || isNaN(g) || g < graduationGrade) return null;
  return currentFiscalYear - 1 - (g - graduationGrade);
}

export function sortPlayers<T extends { grade: string | null; number: string | null }>(
  list: T[],
): T[] {
  return [...list].sort((a, b) => {
    const ga = a.grade !== null ? parseInt(a.grade, 10) : -Infinity;
    const gb = b.grade !== null ? parseInt(b.grade, 10) : -Infinity;
    if (gb !== ga) return gb - ga;
    const na = a.number ? parseInt(a.number, 10) : Infinity;
    const nb = b.number ? parseInt(b.number, 10) : Infinity;
    return na - nb;
  });
}

// 相手選手の背番号は文字列で保存しているため、単純な文字列ソートだと
// "10"が"2"より前に来てしまう。番号として数値比較する。
export function sortOpponentPlayers<T extends { number: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => Number(a.number) - Number(b.number) || a.number.localeCompare(b.number));
}
