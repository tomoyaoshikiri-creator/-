import type { Grade, PlayerStatus, Position, TeamSport } from "@/lib/database.types";

export const GRADES: { value: Grade; label: string }[] = [
  { value: "0", label: "未就学" },
  { value: "1", label: "1年" },
  { value: "2", label: "2年" },
  { value: "3", label: "3年" },
  { value: "4", label: "4年" },
  { value: "5", label: "5年" },
  { value: "6", label: "6年" },
];

// 競技ごとのポジション選択肢。バスケットボールとミニバスケットボールは同じ体系(PG/SG/SF/PF/C)。
export const POSITIONS_BY_SPORT: Record<TeamSport, Position[]> = {
  バスケットボール: ["PG", "SG", "SF", "PF", "C"],
  ミニバスケットボール: ["PG", "SG", "SF", "PF", "C"],
  "サッカー・ミニサッカー": ["GK", "DF", "MF", "FW"],
  "野球・軟式野球": ["投", "捕", "一", "二", "三", "遊", "左", "中", "右"],
  バレーボール: ["S", "OH", "MB", "OP", "L"],
};

export const STATUS_OPTIONS: PlayerStatus[] = ["在籍", "休部", "退団", "OB・OG"];
