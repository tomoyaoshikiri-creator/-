import type { TeamSport } from "@/lib/database.types";
import type { SportContext } from "./types";
import { BASKETBALL_CONTEXT } from "./basketball";
import { MINI_BASKETBALL_CONTEXT } from "./miniBasketball";
import { SOCCER_CONTEXT } from "./soccer";
import { FUTSAL_CONTEXT } from "./futsal";
import { BASEBALL_CONTEXT } from "./baseball";
import { RUGBY_CONTEXT } from "./rugby";
import { HANDBALL_CONTEXT } from "./handball";
import { VOLLEYBALL_CONTEXT } from "./volleyball";

// 8競技全てのSPORT_CONTEXT(Phase 2で残り6競技を追加し、8競技すべて正式対応)。
const SPORT_CONTEXTS: Partial<Record<TeamSport, SportContext>> = {
  バスケットボール: BASKETBALL_CONTEXT,
  ミニバスケットボール: MINI_BASKETBALL_CONTEXT,
  サッカー: SOCCER_CONTEXT,
  フットサル: FUTSAL_CONTEXT,
  野球: BASEBALL_CONTEXT,
  ラグビー: RUGBY_CONTEXT,
  ハンドボール: HANDBALL_CONTEXT,
  バレーボール: VOLLEYBALL_CONTEXT,
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
