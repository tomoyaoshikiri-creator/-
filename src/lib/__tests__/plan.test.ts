import { describe, expect, it } from "vitest";
import {
  PLAN_CONFIG,
  canSelfCheckout,
  hasAiAnalysisAccess,
  hasSkillTestAccess,
  hasSportsTestAccess,
  isInquiryPlan,
  isPublicPlan,
} from "../plan";
import { planKindFor } from "../ai/types";
import type { TeamPlan } from "../database.types";

// PLAN_CONFIGは料金プラン再設計(7プラン体系)の単一の真実の源。プランごとの
// 機能・容量・販売形態の期待値を直接テストすることで、将来の変更でどこかの値だけ
// 更新し忘れることを防ぐ。
describe("PLAN_CONFIG", () => {
  const expected: Record<TeamPlan, (typeof PLAN_CONFIG)[TeamPlan]> = {
    お試し: {
      tier: 0,
      aiAnalysis: false,
      sportsTest: false,
      skillTest: false,
      earlyAccess: false,
      experimentalAccess: false,
      developerAccess: false,
      storageLimitBytes: 104857600,
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
      storageLimitBytes: 1073741824,
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
      storageLimitBytes: 5368709120,
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
      storageLimitBytes: 5368709120,
      canSelfCheckout: true,
      isPublicPlan: true,
      isInquiryPlan: false,
    },
    Max: {
      tier: 4,
      aiAnalysis: true,
      sportsTest: true,
      skillTest: true,
      earlyAccess: false,
      experimentalAccess: false,
      developerAccess: false,
      storageLimitBytes: 10737418240,
      canSelfCheckout: false,
      isPublicPlan: true,
      isInquiryPlan: true,
    },
    max_partner: {
      tier: 4,
      aiAnalysis: true,
      sportsTest: true,
      skillTest: true,
      earlyAccess: true,
      experimentalAccess: false,
      developerAccess: false,
      storageLimitBytes: 10737418240,
      canSelfCheckout: false,
      isPublicPlan: false,
      isInquiryPlan: false,
    },
    signature_edition: {
      tier: 4,
      aiAnalysis: true,
      sportsTest: true,
      skillTest: true,
      earlyAccess: true,
      experimentalAccess: true,
      developerAccess: true,
      storageLimitBytes: 10737418240,
      canSelfCheckout: false,
      isPublicPlan: false,
      isInquiryPlan: false,
    },
  };

  for (const plan of Object.keys(expected) as TeamPlan[]) {
    it(`${plan}の設定値が仕様通り`, () => {
      expect(PLAN_CONFIG[plan]).toEqual(expected[plan]);
    });
  }
});

// 以下は回帰テスト。個々の値というより「複数プランを横断する不変条件」を保護する。
describe("plan回帰テスト", () => {
  it("planKindForはMax/Max Partner/Signature Editionを全て既存のmaxに正規化する(新しいAiPlanKindは増やさない)", () => {
    expect(planKindFor("Max")).toBe("max");
    expect(planKindFor("max_partner")).toBe("max");
    expect(planKindFor("signature_edition")).toBe("max");
    expect(planKindFor("フルプラス")).toBe("proAiPlus");
    expect(planKindFor("お試し")).toBeNull();
    expect(planKindFor("中間")).toBeNull();
    expect(planKindFor("フル")).toBeNull();
  });

  it("Stripeセルフ契約(canSelfCheckout)は中間・フル・フルプラスの3プランのみtrue(checkout/route.tsの許可リストと一致させる)", () => {
    const selfCheckoutPlans = (Object.keys(PLAN_CONFIG) as TeamPlan[]).filter((plan) => canSelfCheckout(plan));
    expect(selfCheckoutPlans.sort()).toEqual(["フル", "フルプラス", "中間"].sort());
  });

  it("スポーツテスト・検定はMax/Max Partner/Signature Editionのみ利用可能", () => {
    for (const plan of ["Max", "max_partner", "signature_edition"] as TeamPlan[]) {
      expect(hasSportsTestAccess(plan)).toBe(true);
      expect(hasSkillTestAccess(plan)).toBe(true);
    }
    for (const plan of ["お試し", "中間", "フル", "フルプラス"] as TeamPlan[]) {
      expect(hasSportsTestAccess(plan)).toBe(false);
      expect(hasSkillTestAccess(plan)).toBe(false);
    }
  });

  it("Pro AI Plus(フルプラス)はAI分析のみ利用可能で、スポーツテスト・検定は利用不可", () => {
    expect(hasAiAnalysisAccess("フルプラス")).toBe(true);
    expect(hasSportsTestAccess("フルプラス")).toBe(false);
    expect(hasSkillTestAccess("フルプラス")).toBe(false);
  });

  it("Max Partner/Signature Editionは一般UIに非公開かつ問い合わせプランでもない(現在のプランとしてのみ表示される)", () => {
    for (const plan of ["max_partner", "signature_edition"] as TeamPlan[]) {
      expect(isPublicPlan(plan)).toBe(false);
      expect(isInquiryPlan(plan)).toBe(false);
    }
  });

  it("Maxは一般に公開されるが個別見積もり制(セルフ契約不可)", () => {
    expect(isPublicPlan("Max")).toBe(true);
    expect(isInquiryPlan("Max")).toBe(true);
    expect(canSelfCheckout("Max")).toBe(false);
  });
});
