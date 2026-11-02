import type { SupabaseClient } from "@supabase/supabase-js";
import { fiscalYearOf } from "@/lib/format";
import { computeDuesPeriods, isPlayerBillableForPeriod, resolveMonthlyAmount } from "@/lib/accountingDues";
import { calculateDuesInstallments } from "@/lib/duesRatePlan";
import { fiscalMonthDate } from "@/lib/duesAnnualSchedule";
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

    const configured = item.schedule_mode === "configured";
    // 新方式は集金月の開始日に対象期間の請求を作成する。
    // 旧方式は従来の計算を維持する。
    const schedule = configured
      ? calculateDuesInstallments({ basis: item.rate_basis, amount: 1, collectionMonths: item.collection_months ?? [] })
      : [];
    const scheduledPeriods = configured
      ? schedule.map((entry) => {
          const start = fiscalMonthDate(fiscalYear, entry.month);
          const nextOffset = entry.coveredMonths.length;
          const [y, m] = start.split("-").map(Number);
          const endDate = new Date(Date.UTC(y, m - 1 + nextOffset, 0));
          return { periodStart: start, periodEnd: endDate.toISOString().slice(0, 10), coveredMonths: entry.coveredMonths };
        }).filter((p) => p.periodStart <= todayStr)
      : computeDuesPeriods(fiscalYear, item.cycle_months, todayStr);
    const periods = scheduledPeriods.filter((p) => !existingStarts.has(p.periodStart));

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
          // 過去の集金月を過ぎてから加入した選手は自動で遡及請求しない。
          // 追加請求は管理者による確認・確定の別フローで扱う。
          if (configured && setting?.start_date && setting.start_date > period.periodStart) return null;
          const monthlyAmount = resolveMonthlyAmount({
            pricingMethod: item.pricing_method as DuesPricingMethod,
            flatMonthlyAmount: item.flat_monthly_amount,
            grade: p.grade !== null ? parseInt(p.grade, 10) : null,
            gradeBands: bands ?? [],
            playerSetting: setting,
          });
          if (monthlyAmount === null && !(configured && item.rate_basis === "yearly")) return null;
          let amount = (monthlyAmount ?? 0) * item.cycle_months;
          if (configured) {
            const covered: number[] = "coveredMonths" in period ? (period.coveredMonths as number[]) : [];
            if (item.rate_basis === "monthly") {
              if (item.join_leave_rule === "prorated") {
                const enrolled = covered.filter((month) => {
                  const date = fiscalMonthDate(fiscalYear, month);
                  const [y, m] = date.split("-").map(Number);
                  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
                  return (!setting?.start_date || setting.start_date <= end) &&
                    (!setting?.stop_date || setting.stop_date >= date);
                });
                amount = (monthlyAmount ?? 0) * enrolled.length;
              } else {
                amount = (monthlyAmount ?? 0) * covered.length;
              }
            } else {
              const annual = setting?.yearly_amount ?? (
                item.pricing_method === "flat" ? item.flat_yearly_amount
                : item.pricing_method === "grade_band"
                  ? (bands ?? []).find((b) => {
                      const grade = p.grade === null ? null : parseInt(p.grade, 10);
                      return grade !== null && grade >= b.grade_min && grade <= b.grade_max;
                    })?.yearly_amount
                  : null
              );
              if (annual === null || annual === undefined) return null;
              const annualPlan = calculateDuesInstallments({
                basis: "yearly", amount: annual, collectionMonths: item.collection_months ?? [],
              });
              amount = annualPlan.find((x) => x.month === Number(period.periodStart.slice(5, 7)))?.amount ?? 0;
            }
          }
          if (!Number.isSafeInteger(amount) || amount <= 0) return null;
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
