import type { SupabaseClient } from "@supabase/supabase-js";
import { fiscalYearOf } from "@/lib/format";
import { computeDuesPeriods, isPlayerBillableForPeriod, resolveMonthlyAmount } from "@/lib/accountingDues";
import type { DuesBillingUnit, DuesPricingMethod } from "@/lib/accounting";
import type { Database } from "@/lib/database.types";

// 請求の生成(集金期間の作成・対象選手の請求行の作成)。accounting_dues_billing_periods/
// accounting_dues_chargesはservice_role(またはこの関数を呼ぶ側で権限確認済みのadmin
// クライアント)でなければinsertできないRLS構成のため、呼び出し側は必ずservice_role
// クライアント(createSupabaseJsClientにSUPABASE_SERVICE_ROLE_KEYを渡したもの)を渡すこと。
// 選手の学年・保護者紐付け・個別設定を横断する処理のため、DB関数ではなくここ(アプリ側)に
// 実装する(cron/api/cron/accounting-dues-generate、手動トリガーのAPIルート双方から呼ぶ)。
export async function generateDuesCharges(
  supabase: SupabaseClient<Database>,
  teamId: string,
  todayStr: string,
  duesItemId?: string,
): Promise<{ periodsCreated: number; chargesCreated: number }> {
  let itemsQuery = supabase.from("accounting_dues_items").select("*").eq("team_id", teamId).eq("active", true);
  if (duesItemId) itemsQuery = itemsQuery.eq("id", duesItemId);
  const { data: items } = await itemsQuery;
  if (!items || items.length === 0) return { periodsCreated: 0, chargesCreated: 0 };

  const fiscalYear = fiscalYearOf(todayStr);
  let periodsCreated = 0;
  let chargesCreated = 0;

  for (const item of items) {
    const [{ data: bands }, { data: settings }, { data: players }, { data: existingPeriods }] = await Promise.all([
      supabase.from("accounting_dues_grade_bands").select("*").eq("dues_item_id", item.id),
      supabase.from("accounting_dues_player_settings").select("*").eq("dues_item_id", item.id),
      supabase.from("players").select("id, grade").eq("team_id", teamId).eq("status", "在籍"),
      supabase.from("accounting_dues_billing_periods").select("period_start").eq("dues_item_id", item.id),
    ]);
    if (!players || players.length === 0) continue;

    const settingByPlayerId = new Map((settings ?? []).map((s) => [s.player_id, s]));
    const existingStarts = new Set((existingPeriods ?? []).map((p) => p.period_start));

    let guardianByPlayerId = new Map<string, string>();
    if ((item.billing_unit as DuesBillingUnit) === "household") {
      const { data: links } = await supabase
        .from("player_guardians")
        .select("player_id, profile_id, created_at")
        .in(
          "player_id",
          players.map((p) => p.id),
        )
        .order("created_at", { ascending: true });
      // 選手ごとに最初に紐づいた保護者を「主たる保護者」とみなし、グループ化のキーにする。
      guardianByPlayerId = new Map();
      (links ?? []).forEach((l) => {
        if (!guardianByPlayerId.has(l.player_id)) guardianByPlayerId.set(l.player_id, l.profile_id);
      });
    }

    const periods = computeDuesPeriods(fiscalYear, item.cycle_months, todayStr).filter((p) => !existingStarts.has(p.periodStart));

    for (const period of periods) {
      const { data: periodRow, error: periodError } = await supabase
        .from("accounting_dues_billing_periods")
        .insert({ dues_item_id: item.id, fiscal_year: fiscalYear, period_start: period.periodStart, period_end: period.periodEnd })
        .select("id")
        .single();
      if (periodError || !periodRow) continue;
      periodsCreated += 1;

      const chargeRows = players
        .map((p) => {
          const setting = settingByPlayerId.get(p.id) ?? null;
          if (!isPlayerBillableForPeriod(period, setting)) return null;
          const monthlyAmount = resolveMonthlyAmount({
            pricingMethod: item.pricing_method as DuesPricingMethod,
            flatMonthlyAmount: item.flat_monthly_amount,
            grade: p.grade !== null ? parseInt(p.grade, 10) : null,
            gradeBands: bands ?? [],
            playerSetting: setting,
          });
          if (monthlyAmount === null) return null;
          const amount = monthlyAmount * item.cycle_months;
          if (amount <= 0) return null;
          const groupKey = (item.billing_unit as DuesBillingUnit) === "household" ? (guardianByPlayerId.get(p.id) ?? p.id) : p.id;
          return { billing_period_id: periodRow.id, player_id: p.id, group_key: groupKey, amount };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);

      if (chargeRows.length > 0) {
        const { error: chargeError } = await supabase.from("accounting_dues_charges").insert(chargeRows);
        if (!chargeError) chargesCreated += chargeRows.length;
      }
    }
  }

  return { periodsCreated, chargesCreated };
}
