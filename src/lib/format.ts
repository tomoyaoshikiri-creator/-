const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
}

export function formatTodayLabel(): string {
  const d = new Date();
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function todayDateStr(): string {
  const d = new Date();
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

export function gradeLabel(grade: string | null): string {
  if (grade === "0") return "未就学";
  if (grade === null || grade === "") return "学年未設定";
  return `${grade}年生`;
}

// 予定の対象学年(target_grade_min、nullなら全員)に選手が含まれるかどうかを判定する。
export function isTargetEligible(playerGrade: string | null, targetGradeMin: string | null): boolean {
  if (targetGradeMin === null) return true;
  const g = playerGrade !== null ? parseInt(playerGrade, 10) : NaN;
  const min = parseInt(targetGradeMin, 10);
  return !isNaN(g) && g >= min;
}

export function obogCohortLabel(grade: string | null): string {
  const g = grade !== null ? parseInt(grade, 10) : NaN;
  if (isNaN(g) || g < 6) return "卒団年次不明";
  const years = g - 6;
  return years === 0 ? "卒団したて" : `卒団${years}年目`;
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
