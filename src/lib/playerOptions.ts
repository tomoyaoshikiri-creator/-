import type { Grade, PlayerStatus, Position } from "@/lib/database.types";

export const GRADES: { value: Grade; label: string }[] = [
  { value: "0", label: "未就学" },
  { value: "1", label: "1年" },
  { value: "2", label: "2年" },
  { value: "3", label: "3年" },
  { value: "4", label: "4年" },
  { value: "5", label: "5年" },
  { value: "6", label: "6年" },
];

export const POSITIONS: Position[] = ["PG", "SG", "SF", "PF", "C"];

export const STATUS_OPTIONS: PlayerStatus[] = ["在籍", "休部", "退団", "OB・OG"];
