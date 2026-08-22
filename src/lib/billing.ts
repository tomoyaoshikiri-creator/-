// StripeのSubscription.statusを基に、設定画面で「お支払いを管理する」(Billing Portal)への
// 導線を出すか、「プランに申し込む」(新規Checkout)への導線を出すかを判定する。
//
// この判定はUI上の導線選択のみを目的とする。プランの利用権限・機能アクセス制御には
// 使用しない(それらはteams.planとsrc/lib/plan.tsのPLAN_CONFIGで別途管理する)。
//
// 「有効なSubscriptionが存在する(=新規Checkoutではなく既存契約の管理に倒すべき)」状態には、
// active/trialingだけでなくpast_due/unpaid/incomplete/pausedのような支払いに問題がある状態も
// 含む。これらの状態で新規Checkoutを案内すると、既存Subscriptionと別に新しいSubscriptionが
// できてしまう(二重課金)おそれがあるため。
//
// canceled/incomplete_expired/null(未契約)のときだけ新規Checkoutへ倒す。Stripe側に将来
// 未知のstatusが追加された場合も、判定対象外の値は「Billing Portalへ倒す」側(true)になるため、
// 安易に新規Checkoutを表示してしまう方向にはずれない。
const NO_ACTIVE_SUBSCRIPTION_STATUSES = new Set(["canceled", "incomplete_expired"]);

export function shouldUseBillingPortal(subscriptionStatus: string | null | undefined): boolean {
  if (subscriptionStatus == null) return false;
  return !NO_ACTIVE_SUBSCRIPTION_STATUSES.has(subscriptionStatus);
}
