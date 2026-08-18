import type { TeamSport } from "@/lib/database.types";
import type { SportContext } from "./types";
import { BASKETBALL_CONTEXT } from "./basketball";
import { MINI_BASKETBALL_CONTEXT } from "./miniBasketball";

// 8競技のうち、Phase 1で実装済みのSPORT_CONTEXT。残り6競技はPhase 2で追加する
// (バスケットボール・ミニバスケットボール以外は現時点でカスタムスタッツのAI分析連携
// 自体が未実装のため、SPORT_CONTEXTだけ先に用意しても中途半端な分析になってしまう)。
const SPORT_CONTEXTS: Partial<Record<TeamSport, SportContext>> = {
  バスケットボール: BASKETBALL_CONTEXT,
  ミニバスケットボール: MINI_BASKETBALL_CONTEXT,
};

export function getSportContext(sport: TeamSport): SportContext {
  const context = SPORT_CONTEXTS[sport];
  if (!context) {
    throw new Error(`この競技(${sport})のAI分析は現在準備中です`);
  }
  return context;
}

export function hasSportContext(sport: TeamSport): boolean {
  return sport in SPORT_CONTEXTS;
}

export type { SportContext };
