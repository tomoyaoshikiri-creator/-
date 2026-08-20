import type { Grade, PlayerStatus, Position, TeamCategory, TeamSport } from "@/lib/database.types";

// カテゴリーごとの学年選択肢。値はplayers.gradeの絶対値スケール(src/lib/category.ts参照)。
// 小学生の7項目は既存の値・ラベルを完全に維持している(既存チームの表示を変えないため)。
// その他は学年概念を持たないため空配列(呼び出し側は空配列の場合、学年選択の代わりに
// 説明文を表示する)。
export const GRADES_BY_CATEGORY: Record<TeamCategory, { value: Grade; label: string }[]> = {
  小学生: [
    { value: "0", label: "未就学" },
    { value: "1", label: "1年" },
    { value: "2", label: "2年" },
    { value: "3", label: "3年" },
    { value: "4", label: "4年" },
    { value: "5", label: "5年" },
    { value: "6", label: "6年" },
  ],
  中学生: [
    { value: "7", label: "中学1年" },
    { value: "8", label: "中学2年" },
    { value: "9", label: "中学3年" },
  ],
  高校生: [
    { value: "10", label: "高校1年" },
    { value: "11", label: "高校2年" },
    { value: "12", label: "高校3年" },
  ],
  大学生: [
    { value: "13", label: "大学1年" },
    { value: "14", label: "大学2年" },
    { value: "15", label: "大学3年" },
    { value: "16", label: "大学4年" },
  ],
  その他: [],
};

// 競技ごとのポジション選択肢。バスケットボールとミニバスケットボールは同じ体系(PG/SG/SF/PF/C)。
export const POSITIONS_BY_SPORT: Record<TeamSport, Position[]> = {
  バスケットボール: ["PG", "SG", "SF", "PF", "C"],
  ミニバスケットボール: ["PG", "SG", "SF", "PF", "C"],
  サッカー: ["GK", "DF", "MF", "FW"],
  フットサル: ["GK", "DF", "MF", "FW"],
  野球: ["投", "捕", "一", "二", "三", "遊", "左", "中", "右"],
  ハンドボール: ["GK", "LB", "CB", "RB", "LW", "RW", "PV"],
  ラグビー: ["PR", "HO", "LO", "FL", "N8", "SH", "SO", "CTB", "WTB", "FB"],
  バレーボール: ["S", "OH", "MB", "OP", "L"],
};

export const STATUS_OPTIONS: PlayerStatus[] = ["在籍", "休部", "退団", "OB・OG"];
