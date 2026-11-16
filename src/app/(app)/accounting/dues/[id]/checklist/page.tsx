"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { EmptyState, SectionLabel, cardClass } from "@/components/ui/Card";
import { InlineSelect } from "@/components/ui/InlineSelect";
import { canManageAccounting } from "@/lib/permissions";
import { hasAccountingAccess } from "@/lib/plan";
import { formatYen, type DuesBillingUnit } from "@/lib/accounting";
import { duesPeriodLabel } from "@/lib/accountingDues";
import { FISCAL_GRID_MONTHS, duesGridStatus, sortDuesPlayers } from "@/lib/duesGrid";
import { loadProfilesMap } from "@/lib/profiles";
import { fiscalYearLabel, fiscalYearOf, playerFullName, sortPlayers, todayDateStr } from "@/lib/format";
import type {
  AccountingDuesBillingPeriod,
  AccountingDuesCharge,
  AccountingDuesItem,
  AccountingDuesPlayerSetting,
  RosterPlayer,
} from "@/lib/database.types";

const CURRENT_FISCAL_YEAR = fiscalYearOf(todayDateStr());
const FISCAL_YEAR_OPTIONS = Array.from({ length: 3 }, (_, i) => CURRENT_FISCAL_YEAR - 1 + i);

interface ChargeGroup {
  groupKey: string;
  label: string;
  amount: number;
  allPaid: boolean;
  chargeIds: string[];
}

export default function AccountingDuesChecklistPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { userId, role, plan } = useSession();
  const toast = useToast();

  useEffect(() => {
    if (!canManageAccounting(role) || !hasAccountingAccess(plan)) router.replace("/accounting");
  }, [role, plan, router]);

  const [fiscalYear, setFiscalYear] = useState(CURRENT_FISCAL_YEAR);
  const [item, setItem] = useState<AccountingDuesItem | null>(null);
  const [periods, setPeriods] = useState<AccountingDuesBillingPeriod[]>([]);
  const [charges, setCharges] = useState<AccountingDuesCharge[]>([]);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [playerSettings, setPlayerSettings] = useState<AccountingDuesPlayerSetting[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: itemRow }, { data: periodRows }, { data: players }, profileMap, { data: settingRows }] = await Promise.all([
      supabase.from("accounting_dues_items").select("*").eq("id", params.id).maybeSingle(),
      supabase
        .from("accounting_dues_billing_periods")
        .select("*")
        .eq("dues_item_id", params.id)
        .eq("fiscal_year", fiscalYear)
        .order("period_start", { ascending: true }),
      supabase.rpc("list_roster_players"),
      loadProfilesMap(supabase),
      supabase.from("accounting_dues_player_settings").select("*").eq("dues_item_id", params.id),
    ]);
    setItem(itemRow ?? null);
    setPeriods(periodRows ?? []);
    setRoster(sortPlayers(players ?? []));
    setProfiles(profileMap);
    setPlayerSettings(settingRows ?? []);

    const periodIds = (periodRows ?? []).map((p) => p.id);
    if (periodIds.length > 0) {
      const { data: chargeRows } = await supabase.from("accounting_dues_charges").select("*").in("billing_period_id", periodIds);
      setCharges(chargeRows ?? []);
    } else {
      setCharges([]);
    }
    setLoading(false);
  }, [params.id, fiscalYear]);

  useEffect(() => {
    load();
  }, [load]);

  const [supplementPlayerId, setSupplementPlayerId] = useState("");
  const [supplementPreview, setSupplementPreview] = useState<{ amount: number; coveredMonths: number[]; start: string; end: string } | null>(null);
  const [supplementBusy, setSupplementBusy] = useState(false);
  async function handleSupplement(confirm: boolean) {
    if (!supplementPlayerId) return;
    setSupplementBusy(true);
    try {
      const res = await fetch("/api/accounting/dues/joining-supplement", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duesItemId: params.id, playerId: supplementPlayerId, fiscalYear, confirm }),
      });
      const result = await res.json();
      if (!res.ok) { toast.error(result.error ?? "追加請求を確認できません"); setSupplementPreview(null); return; }
      if (confirm) {
        toast.success("追加請求を確定しました");
        setSupplementPreview(null);
        setSupplementPlayerId("");
        await load();
      } else setSupplementPreview(result.preview);
    } catch { toast.error("通信に失敗しました"); }
    finally { setSupplementBusy(false); }
  }

  const [generating, setGenerating] = useState(false);
  async function handleGenerate() {
    setGenerating(true);
    const res = await fetch("/api/accounting/dues/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duesItemId: params.id }),
    });
    setGenerating(false);
    if (!res.ok) {
      toast.error("請求の作成に失敗しました");
      return;
    }
    const json = await res.json();
    toast.success(json.periodsCreated > 0 ? `${json.periodsCreated}期間分の請求を作成しました` : "新しく作成する請求はありませんでした");
    load();
  }

  function nameOfPlayer(playerId: string): string {
    const p = roster.find((r) => r.id === playerId);
    return p ? playerFullName(p) : "(卒団済みなどの選手)";
  }

  // 対象外(exempt)はこの集金項目に対する選手単位の設定(選手ごとの個別設定と同じ
  // accounting_dues_player_settings)で、月ごとではなく項目全体にかかる。学年帯の対象外
  // (このJBA登録のように、特定の学年に学年帯そのものが設定されていない場合)は請求が
  // 作られないだけで「対象外」と確定しているわけではないため、ここで明示的に設定できる
  // ようにする(入金チェック画面からここだけを素早く切り替えられるよう、料金・備考等の
  // 個別設定とは別に単独で保存する)。
  function settingForPlayer(playerId: string): AccountingDuesPlayerSetting | null {
    return playerSettings.find((s) => s.player_id === playerId) ?? null;
  }

  const [exemptToggling, setExemptToggling] = useState<string | null>(null);
  async function handleToggleExempt(playerId: string) {
    if (!item) return;
    const existing = settingForPlayer(playerId);
    const nextExempt = !(existing?.exempt ?? false);
    setExemptToggling(playerId);
    const supabase = createClient();
    if (existing) {
      const { error } = await supabase.from("accounting_dues_player_settings").update({ exempt: nextExempt }).eq("id", existing.id);
      setExemptToggling(null);
      if (error) {
        toast.error(`更新に失敗しました: ${error.message}`);
        return;
      }
      setPlayerSettings((prev) => prev.map((s) => (s.id === existing.id ? { ...s, exempt: nextExempt } : s)));
    } else {
      const { data, error } = await supabase
        .from("accounting_dues_player_settings")
        .insert({ dues_item_id: item.id, player_id: playerId, exempt: nextExempt })
        .select("*")
        .single();
      setExemptToggling(null);
      if (error || !data) {
        toast.error(`更新に失敗しました: ${error?.message ?? ""}`);
        return;
      }
      setPlayerSettings((prev) => [...prev, data]);
    }
    toast.success(nextExempt ? "対象外に設定しました" : "対象外を解除しました");
  }

  function groupsForPeriod(periodId: string): ChargeGroup[] {
    const periodCharges = charges.filter((c) => c.billing_period_id === periodId);
    const byGroup = new Map<string, AccountingDuesCharge[]>();
    periodCharges.forEach((c) => {
      const arr = byGroup.get(c.group_key) ?? [];
      arr.push(c);
      byGroup.set(c.group_key, arr);
    });
    const billingUnit = item?.billing_unit as DuesBillingUnit | undefined;
    return [...byGroup.entries()].map(([groupKey, groupCharges]) => {
      const playerNames = groupCharges.map((c) => nameOfPlayer(c.player_id)).join("・");
      const label = billingUnit === "household" && profiles[groupKey] ? `${profiles[groupKey]}(${playerNames})` : playerNames;
      return {
        groupKey,
        label,
        amount: groupCharges.reduce((sum, c) => sum + Number(c.amount), 0),
        allPaid: groupCharges.every((c) => c.status === "paid"),
        chargeIds: groupCharges.map((c) => c.id),
      };
    });
  }

  const [toggling, setToggling] = useState<string | null>(null);
  async function handleToggleGroup(group: ChargeGroup) {
    setToggling(group.groupKey);
    const supabase = createClient();
    const nextStatus = group.allPaid ? "unpaid" : "paid";
    const { error } = await supabase
      .from("accounting_dues_charges")
      .update({
        status: nextStatus,
        paid_at: nextStatus === "paid" ? new Date().toISOString() : null,
        paid_by: nextStatus === "paid" ? userId : null,
      })
      .in("id", group.chargeIds);
    setToggling(null);
    if (error) {
      toast.error(`更新に失敗しました: ${error.message}`);
      return;
    }
    setCharges((prev) =>
      prev.map((c) =>
        group.chargeIds.includes(c.id)
          ? { ...c, status: nextStatus, paid_at: nextStatus === "paid" ? new Date().toISOString() : null, paid_by: nextStatus === "paid" ? userId : null }
          : c,
      ),
    );
  }

  const [gridUpdating, setGridUpdating] = useState<string | null>(null);
  async function handleGridToggle(playerId: string, month: number) {
    const ids = new Set(periods.filter(p => Number(p.period_start.slice(5, 7)) === month).map(p => p.id));
    const selected = charges.filter(c => c.player_id === playerId && ids.has(c.billing_period_id));
    if (selected.length === 0) return;
    const targets = charges.filter(c => selected.some(s => s.billing_period_id === c.billing_period_id && s.group_key === c.group_key));
    const key = `${playerId}:${month}`;
    setGridUpdating(key);
    const nextStatus = selected.every(c => c.status === "paid") ? "unpaid" : "paid";
    const now = new Date().toISOString();
    const supabase = createClient();
    const { error } = await supabase.from("accounting_dues_charges")
      .update({
        status: nextStatus,
        paid_at: nextStatus === "paid" ? now : null,
        paid_by: nextStatus === "paid" ? userId : null,
      }).in("id", targets.map(c => c.id));
    setGridUpdating(null);
    if (error) {
      toast.error(`入金状態の更新に失敗しました: ${error.message}`);
      return;
    }
    const selectedIds = new Set(targets.map(c => c.id));
    setCharges(prev => prev.map(c => selectedIds.has(c.id)
      ? { ...c, status: nextStatus, paid_at: nextStatus === "paid" ? now : null, paid_by: nextStatus === "paid" ? userId : null }
      : c));
  }

  // 一括生成で在籍していなかった期間にも請求が作られてしまった選手を、期間単位で
  // 個別に取り消せるようにする(ユーザー指示: 項目全体を対象外にする既存のトグルとは
  // 別に、特定の選手の特定の期間分だけを「－」に戻したい)。削除は取り消せないため、
  // 他の削除ボタンと同じ二度タップ確定の形にする。
  const [deleteConfirmKey, setDeleteConfirmKey] = useState<string | null>(null);
  const [deletingCharge, setDeletingCharge] = useState<string | null>(null);
  async function handleDeleteCharge(periodId: string, group: ChargeGroup) {
    const key = `${periodId}:${group.groupKey}`;
    if (deleteConfirmKey !== key) {
      setDeleteConfirmKey(key);
      setTimeout(() => setDeleteConfirmKey((cur) => (cur === key ? null : cur)), 3000);
      return;
    }
    setDeleteConfirmKey(null);
    setDeletingCharge(key);
    const supabase = createClient();
    const { error } = await supabase.from("accounting_dues_charges").delete().in("id", group.chargeIds);
    setDeletingCharge(null);
    if (error) {
      toast.error(`取り消しに失敗しました: ${error.message}`);
      return;
    }
    setCharges((prev) => prev.filter((c) => !group.chargeIds.includes(c.id)));
    toast.success("この請求を取り消しました");
  }

  const [bulkChecking, setBulkChecking] = useState<string | null>(null);
  async function handleBulkCheck(periodId: string) {
    setBulkChecking(periodId);
    const supabase = createClient();
    const unpaidIds = charges.filter((c) => c.billing_period_id === periodId && c.status === "unpaid").map((c) => c.id);
    if (unpaidIds.length === 0) {
      setBulkChecking(null);
      return;
    }
    const { error } = await supabase
      .from("accounting_dues_charges")
      .update({ status: "paid", paid_at: new Date().toISOString(), paid_by: userId })
      .in("id", unpaidIds);
    setBulkChecking(null);
    if (error) {
      toast.error(`更新に失敗しました: ${error.message}`);
      return;
    }
    toast.success(`${unpaidIds.length}件を入金済みにしました`);
    load();
  }

  if (loading) {
    return (
      <PageShell header={<AppHeader title="入金チェック" variant="detail" backHref="/accounting/dues" accessBadge="operations" />}>
        <EmptyState>読み込み中…</EmptyState>
      </PageShell>
    );
  }
  if (!item) {
    return (
      <PageShell header={<AppHeader title="入金チェック" variant="detail" backHref="/accounting/dues" accessBadge="operations" />}>
        <div className={cardClass}>
          <EmptyState>この集金項目は見つかりませんでした</EmptyState>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell header={<AppHeader title={`入金チェック: ${item.name}`} variant="detail" backHref={`/accounting/dues/${item.id}`} accessBadge="operations" />}>
      <div className="flex justify-end gap-3 mb-2 text-[12px] font-bold">
        <Link href={`/accounting/dues/${item.id}`} className="text-blue-600">料金・集金設定</Link>
        <Link href="/accounting/dues?manage=1" className="text-blue-600">集金項目の管理</Link>
      </div>
      <SectionLabel>年度</SectionLabel>
      <div className={cardClass}>
        <InlineSelect
          value={String(fiscalYear)}
          onChange={(v) => setFiscalYear(Number(v))}
          options={FISCAL_YEAR_OPTIONS.map((y) => ({ value: String(y), label: fiscalYearLabel(y) }))}
        />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="w-full mt-2.5 text-center py-2 rounded-lg font-bold text-[12px] border border-orange text-orange-text bg-orange/8 disabled:opacity-50"
        >
          {generating ? "作成中…" : "本日時点の請求を作成する"}
        </button>
        <div className="text-[10.5px] text-ink-soft mt-1.5">
          通常は毎朝自動で作成されます。集金項目を追加した直後など、すぐに確認したいときに使ってください。
        </div>
      </div>

      {item.schedule_mode === "configured" && item.rate_basis === "monthly" && (
        <>
          <SectionLabel>途中入団の追加請求</SectionLabel>
          <div className={cardClass}>
            <p className="text-[11px] text-ink-soft mb-2">入団日を選手別料金設定に登録した選手が対象です。金額を確認してから確定します。</p>
            <select className="w-full border border-line rounded-lg p-2 text-[13px] bg-paper" value={supplementPlayerId}
              onChange={e => { setSupplementPlayerId(e.target.value); setSupplementPreview(null); }}>
              <option value="">選手を選択</option>
              {sortDuesPlayers(roster).map(p => <option key={p.id} value={p.id}>{playerFullName(p)}</option>)}
            </select>
            <button type="button" disabled={!supplementPlayerId || supplementBusy} onClick={() => handleSupplement(false)}
              className="mt-2 px-3 py-2 rounded-lg border border-line text-[12px] font-bold disabled:opacity-50">追加請求を確認</button>
            {supplementPreview && (
              <div className="mt-3 border-t border-line pt-3">
                <p className="text-[12px] font-bold">対象：{supplementPreview.coveredMonths.join("・")}月分 ／ {formatYen(supplementPreview.amount)}</p>
                <p className="text-[11px] text-ink-soft mt-1">確定後は請求が作成されます。既存の入金済み請求は変更しません。</p>
                <button type="button" disabled={supplementBusy} onClick={() => handleSupplement(true)}
                  className="mt-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-[12px] font-bold disabled:opacity-50">この金額で請求を確定</button>
              </div>
            )}
          </div>
        </>
      )}
      <SectionLabel>選手別・年間入金一覧</SectionLabel>
      <div className={cardClass}>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="border-b border-line">
                <th className="sticky left-0 bg-paper text-left px-2 py-2 min-w-[110px]">選手</th>
                {FISCAL_GRID_MONTHS.map(month => <th key={month} className="text-center px-1 py-2 min-w-[35px]">{month}月</th>)}
              </tr>
            </thead>
            <tbody>
              {sortDuesPlayers(roster).map(player => {
                const exempt = settingForPlayer(player.id)?.exempt ?? false;
                return (
                <tr key={player.id} className={`border-b border-line last:border-b-0 ${exempt ? "opacity-60" : ""}`}>
                  <th className="sticky left-0 bg-paper text-left px-2 py-2 font-semibold whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>{playerFullName(player)}</span>
                      <button
                        type="button"
                        onClick={() => handleToggleExempt(player.id)}
                        disabled={exemptToggling !== null}
                        aria-label={`${playerFullName(player)}をこの集金項目の対象外${exempt ? "から解除" : "に設定"}`}
                        className={`flex-none font-bold px-1.5 py-0.5 rounded-full border disabled:opacity-50 ${
                          exempt ? "border-orange text-orange-text bg-orange/8" : "border-line text-ink-soft bg-paper"
                        }`}
                        style={{ fontSize: "9.5px" }}
                      >
                        対象外
                      </button>
                    </div>
                  </th>
                  {FISCAL_GRID_MONTHS.map(month => {
                    const status = duesGridStatus(player.id, month, periods, charges);
                    return <td key={month} className="text-center px-1 py-2 font-bold">
                      {status === "none" ? (
                        <span className="text-ink-soft">{exempt ? "対象外" : "－"}</span>
                      ) : (
                        <button type="button" aria-label={`${playerFullName(player)} ${month}月 ${status === "paid" ? "入金済み" : "未入金"}。タップして変更`}
                          onClick={() => handleGridToggle(player.id, month)}
                          disabled={gridUpdating !== null}
                          className={`min-w-[28px] py-1 rounded-md border disabled:opacity-50 ${status === "paid" ? "border-green text-green-text bg-green/8" : "border-orange text-orange-text bg-orange/8"}`}>
                          {status === "paid" ? "済" : "未"}
                        </button>
                      )}
                    </td>;
                  })}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-ink-soft mt-2">
          「済」は入金済み、「未」は請求済み・未入金、「－」は請求なし。「済」「未」をタップすると入金状態を変更できます。
          選手名の横の「対象外」をタップすると、この集金項目自体を対象外に設定・解除できます(学年帯等で元々請求が作られない選手でも、対象外であることを明示できます)。
        </p>
      </div>

      {periods.length === 0 ? (
        <div className={cardClass}>
          <EmptyState>まだ請求がありません</EmptyState>
        </div>
      ) : (
        periods.map((period) => {
          const groups = groupsForPeriod(period.id);
          const unpaidCount = groups.filter((g) => !g.allPaid).length;
          return (
            <div key={period.id} className="mb-3">
              <SectionLabel>{duesPeriodLabel({ periodStart: period.period_start, periodEnd: period.period_end })}</SectionLabel>
              <div className={cardClass}>
                {groups.length === 0 ? (
                  <EmptyState>対象者がいません</EmptyState>
                ) : (
                  <>
                    <ul>
                      {groups.map((g) => {
                        const deleteKey = `${period.id}:${g.groupKey}`;
                        return (
                        <li key={g.groupKey} className="flex items-center justify-between gap-2 py-2 border-b border-line last:border-b-0">
                          <div className="min-w-0">
                            <div className="text-[13px] font-bold truncate">{g.label}</div>
                            <div className="text-[11px] text-ink-soft">{formatYen(g.amount)}</div>
                          </div>
                          <div className="flex-none flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleGroup(g)}
                              disabled={toggling === g.groupKey}
                              className={`px-3 py-1.5 rounded-lg text-[11.5px] font-bold border disabled:opacity-50 ${
                                g.allPaid ? "border-green text-green-text bg-green/8" : "border-line text-ink-soft bg-paper"
                              }`}
                            >
                              {g.allPaid ? "入金済み" : "未納"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCharge(period.id, g)}
                              disabled={deletingCharge === deleteKey}
                              aria-label={`${g.label}の${duesPeriodLabel({ periodStart: period.period_start, periodEnd: period.period_end })}の請求を取り消す`}
                              className="px-2 py-1.5 rounded-lg text-[11px] font-bold border whitespace-nowrap disabled:opacity-50 bg-white"
                              style={{ color: "var(--danger-text)", borderColor: "var(--danger)" }}
                            >
                              {deletingCharge === deleteKey ? "取消中…" : deleteConfirmKey === deleteKey ? "もう一度タップで取消確定" : "取消"}
                            </button>
                          </div>
                        </li>
                        );
                      })}
                    </ul>
                    {unpaidCount > 1 && (
                      <button
                        type="button"
                        onClick={() => handleBulkCheck(period.id)}
                        disabled={bulkChecking === period.id}
                        className="w-full mt-2.5 text-center py-1.5 rounded-lg font-bold text-[11.5px] border border-line bg-paper text-ink-soft disabled:opacity-50"
                      >
                        未納分をまとめて入金済みにする({unpaidCount}件)
                      </button>
                    )}
                    <p className="text-[10.5px] text-ink-soft mt-2">
                      「取消」はこの選手・この期間分の請求のみを取り消して「－」に戻します(一括生成等で在籍していなかった期間に誤って請求が作られた場合の修正用)。項目全体を対象外にしたい場合は上の一覧の「対象外」を使ってください。
                    </p>
                  </>
                )}
              </div>
            </div>
          );
        })
      )}
    </PageShell>
  );
}
