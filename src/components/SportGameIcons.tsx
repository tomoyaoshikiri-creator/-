import type { SVGProps } from "react";
import type { TeamSport } from "@/lib/database.types";

// ゲームタブ専用。採用デザイン「案A / 2枚目」: 単色・アウトライン。
// 全種目を24x24、strokeWidth=1.8、丸端・丸角で統一する。
type Props = SVGProps<SVGSVGElement>;
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function BasketballIcon(props: Props) {
  return <svg {...base} {...props} aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3v18M3 12h18M6.6 4.9C10.8 8.5 10.8 15.5 6.6 19.1M17.4 4.9c-4.2 3.6-4.2 10.6 0 14.2" />
  </svg>;
}

function SoccerIcon(props: Props) {
  return <svg {...base} {...props} aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="m12 8 3.8 2.8-1.4 4.4H9.6l-1.4-4.4L12 8ZM12 8V3M15.8 10.8l4.6-1.5M14.4 15.2l2.9 4M9.6 15.2l-2.9 4M8.2 10.8 3.6 9.3" />
  </svg>;
}

function BaseballIcon(props: Props) {
  return <svg {...base} {...props} aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M7 4.6c4.2 4 4.2 10.8 0 14.8M17 4.6c-4.2 4-4.2 10.8 0 14.8" />
    <path d="m7.6 7.2-2 1.1m2.8 2.2-2.3 1m2.4 2.4-2.3 1m1.4 2.3-2 1.1m10.8-11.1 2 1.1m-2.8 2.2 2.3 1m-2.4 2.4 2.3 1m-1.4 2.3 2 1.1" />
  </svg>;
}

function RugbyIcon(props: Props) {
  return <svg {...base} {...props} aria-hidden="true">
    <path d="M20.7 3.3C14.2 2.3 7.7 5.4 4.5 10.2c-2.1 3.2-2.6 7-1.2 10.5 6.5 1 13-2.1 16.2-6.9 2.1-3.2 2.6-7 1.2-10.5Z" />
    <path d="M8.7 9.2 14.8 15.3M10.3 8.3l-2.1 2.1m4.3-.5-2.1 2.1m4.2-.4-2.1 2.1" />
  </svg>;
}

function VolleyballIcon(props: Props) {
  return <svg {...base} {...props} aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M7.3 4.3c1.4 4.1 5 5.4 9.2 5.5M3.6 8.8c3.8-1.1 7.5 1.2 9.3 4.4m-6.7 6.2c.1-4.3 2.6-7.4 6.7-9.1m6.9-4.6c-4 1-6.4 3.7-6.9 7.5m6.4 5.1c-2.4-3.2-5.9-4.5-9.8-3.9" />
  </svg>;
}

function HandballIcon(props: Props) {
  return <svg {...base} {...props} aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3v4.2M12 16.8V21M3 12h4.2M16.8 12H21" />
    <path d="M12 7.2 16.8 12 12 16.8 7.2 12Z" />
    <path d="m5.6 5.6 3.1 3.1m6.6 6.6 3.1 3.1m0-12.8-3.1 3.1m-6.6 6.6-3.1 3.1" />
  </svg>;
}

export const GAME_ICONS_BY_SPORT: Record<TeamSport, (props: { className?: string }) => React.ReactElement> = {
  "バスケットボール": BasketballIcon,
  "ミニバスケットボール": BasketballIcon,
  "サッカー": SoccerIcon,
  "フットサル": SoccerIcon,
  "野球": BaseballIcon,
  "ラグビー": RugbyIcon,
  "ハンドボール": HandballIcon,
  "バレーボール": VolleyballIcon,
};
