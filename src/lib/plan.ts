import type { TeamPlan } from "@/lib/database.types";

// プランごとの機能・容量・販売形態を一元管理する設定。
// DB(teams_plan_check)・Stripe(src/lib/stripe.tsのPAID_PLAN_PRICE_ENV)・
// storage_limit_bytesを自動算出するDBトリガー(supabase/migrations/*_sync_team_storage_limit)
// はそれぞれ別の関心事のため統合していないが、値は互いに対応させてあり、
// 変更する際はこの4箇所を揃えること(該当箇所にコメントで相互参照を残している)。
//
// tierは「上位プランは下位プランの機能を含む」という一般的な階層比較(コーチノート・
// カルテタブ等の既存の段階的機能)にのみ使う。AI分析・スポーツテスト・検定・
// Early Access・Experimental・Developer向け機能のような「特定プラン群だけが持つ
// 特殊機能」は、tier比較ではなく必ずこのオブジェクトの個別フラグで判定する
// (tier >= 4のような閾値判定に頼ると、将来tierだけ同じで機能が異なるプランを
// 追加したときに誤判定するため)。
interface PlanCapabilities {
  tier: number;
  aiAnalysis: boolean;
  sportsTest: boolean;
  skillTest: boolean;
  earlyAccess: boolean;
  experimentalAccess: boolean;
  developerAccess: boolean;
  // バイト数。supabase/migrations内のsync_team_storage_limit()トリガーが
  // teams.storage_limit_bytesを自動算出する際の値と一致させること。
  storageLimitBytes: number;
  // ユーザー自身がStripe Checkoutから契約・変更できるか。
  canSelfCheckout: boolean;
  // 一般ユーザーに存在を見せてよいか(料金非公開でも「Max」という名称自体は見せてよい場合はtrue、
  // Max Partner/Signature Editionのように名称自体を一般UIに出さない場合はfalse)。
  isPublicPlan: boolean;
  // プラン画面等で「個別見積もり・お問い合わせ」の案内に留めるべきか。
  isInquiryPlan: boolean;
}

export const PLAN_CONFIG: Record<TeamPlan, PlanCapabilities> = {
  お試し: {
    tier: 0,
    aiAnalysis: false,
    sportsTest: false,
    skillTest: false,
    earlyAccess: false,
    experimentalAccess: false,
    developerAccess: false,
    storageLimitBytes: 104857600, // 100MiB
    canSelfCheckout: false,
    isPublicPlan: true,
    isInquiryPlan: false,
  },
  中間: {
    tier: 1,
    aiAnalysis: false,
    sportsTest: false,
    skillTest: false,
    earlyAccess: false,
    experimentalAccess: false,
    developerAccess: false,
    storageLimitBytes: 1073741824, // 1GiB
    canSelfCheckout: true,
    isPublicPlan: true,
    isInquiryPlan: false,
  },
  フル: {
    tier: 2,
    aiAnalysis: false,
    sportsTest: false,
    skillTest: false,
    earlyAccess: false,
    experimentalAccess: false,
    developerAccess: false,
    storageLimitBytes: 5368709120, // 5GiB
    canSelfCheckout: true,
    isPublicPlan: true,
    isInquiryPlan: false,
  },
  フルプラス: {
    tier: 3,
    aiAnalysis: true,
    sportsTest: false,
    skillTest: false,
    earlyAccess: false,
    experimentalAccess: false,
    developerAccess: false,
    storageLimitBytes: 5368709120, // 5GiB
    canSelfCheckout: true,
    isPublicPlan: true,
    isInquiryPlan: false,
  },
  // 正式販売プランだが個別見積もり制(セルフ契約不可・価格非公開・Stripe対象外)。
  Max: {
    tier: 4,
    aiAnalysis: true,
    sportsTest: true,
    skillTest: true,
    earlyAccess: false,
    experimentalAccess: false,
    developerAccess: false,
    storageLimitBytes: 10737418240, // 10GiB
    canSelfCheckout: false,
    isPublicPlan: true,
    isInquiryPlan: true,
  },
  // モニター・開発協力チーム向け非売品。一般UIには一切表示せず、運営が手動で付与する。
  max_partner: {
    tier: 4,
    aiAnalysis: true,
    sportsTest: true,
    skillTest: true,
    earlyAccess: true,
    experimentalAccess: false,
    developerAccess: false,
    storageLimitBytes: 10737418240, // 10GiB
    canSelfCheckout: false,
    isPublicPlan: false,
    isInquiryPlan: false,
  },
  // 都賀ビクトリーズ専用の完全非売品プラン。DB側の最終防御はsupabase/migrations参照。
  signature_edition: {
    tier: 4,
    aiAnalysis: true,
    sportsTest: true,
    skillTest: true,
    earlyAccess: true,
    experimentalAccess: true,
    developerAccess: true,
    storageLimitBytes: 10737418240, // 10GiB
    canSelfCheckout: false,
    isPublicPlan: false,
    isInquiryPlan: false,
  },
};

function tierOf(plan: TeamPlan): number {
  return PLAN_CONFIG[plan].tier;
}

export const FREE_PLAYER_LIMIT = 15;

export function playerLimitForPlan(plan: TeamPlan): number | null {
  return plan === "お試し" ? FREE_PLAYER_LIMIT : null;
}

// お試しプランはチーム日報を直近30日分、試合結果を直近5件のみ閲覧可能(データ自体は
// 削除しない。中間プラン以上に上げれば同じデータがそのまま全件見えるようになる)。
export const FREE_REPORT_WINDOW_DAYS = 30;
export const FREE_GAME_RESULT_LIMIT = 5;

export function hasFullReportHistoryAccess(plan: TeamPlan): boolean {
  return tierOf(plan) >= tierOf("中間");
}

export function hasFullGameHistoryAccess(plan: TeamPlan): boolean {
  return tierOf(plan) >= tierOf("中間");
}

// コーチ日報タブ・練習メニュー(予定詳細に埋め込み)は中間プラン以上で利用可能。
export function hasCoachNoteAccess(plan: TeamPlan): boolean {
  return tierOf(plan) >= tierOf("中間");
}

export function hasPracticeMenuAccess(plan: TeamPlan): boolean {
  return tierOf(plan) >= tierOf("中間");
}

// CLUB KARTEの「チームカルテ」「選手カルテ」(試合スタッツ・カルテ閲覧・AI分析・
// 保護者向けチーム平均公開)はフルプラン以上で利用可能。「選手一覧」自体は含まない
// (基本機能として全プランで利用可能)。
export function hasKarteTabAccess(plan: TeamPlan): boolean {
  return tierOf(plan) >= tierOf("フル");
}

// スポーツテストはMax/Max Partner/Signature Editionのみ利用可能。
export function hasSportsTestAccess(plan: TeamPlan): boolean {
  return PLAN_CONFIG[plan].sportsTest;
}

// 検定(ドリブル検定等)もスポーツテストと同じくMax/Max Partner/Signature Edition限定。
export function hasSkillTestAccess(plan: TeamPlan): boolean {
  return PLAN_CONFIG[plan].skillTest;
}

// AI分析(実際にAnthropic APIを呼び出して分析コメントを生成する)は
// フルプラス(Pro AI Plus)/Max/Max Partner/Signature Editionで利用可能。
export function hasAiAnalysisAccess(plan: TeamPlan): boolean {
  return PLAN_CONFIG[plan].aiAnalysis;
}

// 正式リリース前機能の先行利用(Max Partner/Signature Edition限定)。
export function hasEarlyAccess(plan: TeamPlan): boolean {
  return PLAN_CONFIG[plan].earlyAccess;
}

// 検証中の実験的機能(Signature Edition限定)。
export function hasExperimentalAccess(plan: TeamPlan): boolean {
  return PLAN_CONFIG[plan].experimentalAccess;
}

// 開発者向け機能(Signature Edition限定)。
export function hasDeveloperAccess(plan: TeamPlan): boolean {
  return PLAN_CONFIG[plan].developerAccess;
}

// ユーザー自身がStripe Checkoutから契約・変更できるプランか
// (中間・フル・フルプラスのみtrue。Max以上は運営が個別に付与する)。
export function canSelfCheckout(plan: TeamPlan): boolean {
  return PLAN_CONFIG[plan].canSelfCheckout;
}

// 一般ユーザーに存在を見せてよいプランか(Max Partner/Signature Editionは
// 一般のプラン選択UI・料金表示には一切出さない)。
export function isPublicPlan(plan: TeamPlan): boolean {
  return PLAN_CONFIG[plan].isPublicPlan;
}

// プラン画面で「個別見積もり・お問い合わせ」の案内に留めるべきプランか(Maxのみ)。
export function isInquiryPlan(plan: TeamPlan): boolean {
  return PLAN_CONFIG[plan].isInquiryPlan;
}

export function storageLimitBytesForPlan(plan: TeamPlan): number {
  return PLAN_CONFIG[plan].storageLimitBytes;
}
