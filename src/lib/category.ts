import type { TeamCategory } from "@/lib/database.types";

export const CATEGORIES: TeamCategory[] = ["小学生", "中学生", "高校生", "大学生", "その他"];

export const CATEGORY_DISPLAY_LABELS: Record<TeamCategory, string> = {
  小学生: "小学生",
  中学生: "中学生",
  高校生: "高校生",
  大学生: "大学生",
  その他: "その他",
};

// players.gradeは絶対値の17段階スケール(0=未就学,1-6=小学,7-9=中学,10-12=高校,
// 13-16=大学)で管理する。この値はカテゴリーごとの卒業学年(この学年に達した選手が
// 年度更新でOB・OGへ卒団する)。その他は学年概念を持たないためnull。
export const GRADUATION_GRADE_BY_CATEGORY: Record<TeamCategory, number | null> = {
  小学生: 6,
  中学生: 9,
  高校生: 12,
  大学生: 16,
  その他: null,
};

// カテゴリー内で最初の学年に対応するgrade値(小学生は"1年生"がgrade=1、
// 中学生は"中学1年"がgrade=7、というように、カテゴリー内の相対学年 =
// grade - (MIN_GRADE_BY_CATEGORY[category] - 1) で求められる)。その他は学年概念を
// 持たないためnull。
export const MIN_GRADE_BY_CATEGORY: Record<TeamCategory, number | null> = {
  小学生: 1,
  中学生: 7,
  高校生: 10,
  大学生: 13,
  その他: null,
};

// 「ミニバスケットボール」は小学生カテゴリー専用(U12前提のルールのため)。
export function isMiniBasketballAllowed(category: TeamCategory): boolean {
  return category === "小学生";
}
