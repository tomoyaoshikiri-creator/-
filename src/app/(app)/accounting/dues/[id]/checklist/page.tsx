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
import { Modal } from "@/components/ui/Modal";
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

  function groupsForPeriod(periodId: string, opts: { cancelled?: boolean } = {}): ChargeGroup[] {
    const wantCancelled = opts.cancelled ?? false;
    const periodCharges = charges.filter((c) => c.billing_period_id === periodId && Boolean(c.cancelled_at) === wantCancelled);
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

  const [gridUpdating, setGridUpdating] = useState<string | null>(null);
  async function handleGridToggle(playerId: string, month: number) {
    const ids = new Set(periods.filter(p => Number(p.period_start.slice(5, 7)) === month).map(p => p.id));
    const selected = charges.filter(c => c.player_id === playerId && ids.has(c.billing_period_id) && !c.cancelled_at);
    if (selected.length === 0) return;
    const targets = charges.filter(c => !c.cancelled_at && selected.some(s => s.billing_period_id === c.billing_period_id && s.group_key === c.group_key));
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

  // 選手×12ヶ月の表の下に、期間ごとに同じ選手一覧を繰り返して並べると
  // ページが無駄に長くなる(例: 3か月ごとの項目で3期×20名=60行)ため、
  // 一覧の重複表示はやめ、未納の一括チェックと個別取消は「期間を選んで使う」
  // 1つのコンパクトな操作欄にまとめる(ユーザー指示)。選手ごとの入金済み/未納の
  // 切り替えそのものは上の表のセルで行える。
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [correctionGroupKey, setCorrectionGroupKey] = useState("");
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deletingCharge, setDeletingCharge] = useState(false);

  // 請求の「取消」はDELETEではなくcancelled_at/cancelled_byによるソフトキャンセルで行う
  // (accounting_dues_chargesにはDELETEのRLSポリシーが無く、クライアントからのDELETEは
  // エラーにならないまま0件削除になっていたため、UPDATEで届く形に変更。併せて復元もできる)。
  async function softCancelCharges(chargeIds: string[]): Promise<string | null> {
    const supabase = createClient();
    const now = new Date().toISOString();
    const { error } = await supabase.from("accounting_dues_charges")
      .update({ cancelled_at: now, cancelled_by: userId }).in("id", chargeIds);
    if (error) return error.message;
    setCharges((prev) => prev.map((c) => chargeIds.includes(c.id) ? { ...c, cancelled_at: now, cancelled_by: userId } : c));
    return null;
  }
  async function restoreCharges(chargeIds: string[]): Promise<string | null> {
    const supabase = createClient();
    const { error } = await supabase.from("accounting_dues_charges")
      .update({ cancelled_at: null, cancelled_by: null }).in("id", chargeIds);
    if (error) return error.message;
    setCharges((prev) => prev.map((c) => chargeIds.includes(c.id) ? { ...c, cancelled_at: null, cancelled_by: null } : c));
    return null;
  }

  async function handleDeleteCharge(group: ChargeGroup) {
    if (!deleteConfirming) {
      setDeleteConfirming(true);
      setTimeout(() => setDeleteConfirming((cur) => (cur ? false : cur)), 3000);
      return;
    }
    setDeletingCharge(true);
    const error = await softCancelCharges(group.chargeIds);
    setDeletingCharge(false);
    if (error) {
      toast.error(`取り消しに失敗しました: ${error}`);
      return;
    }
    toast.success("この請求を取り消しました");
    setCorrectionGroupKey("");
    setDeleteConfirming(false);
  }

  // 対象外の設定・請求の個別取消/復元は、表の選手名をタップして開く操作画面にまとめる
  // (常時表示のボタンは全選手に並んで邪魔な上、既存の請求が残ったままだと「対象外」表示と
  // 「未」表示が同時に出て紛らわしいため、該当選手の請求一覧と一緒に操作できるようにする)。
  const [operationPlayerId, setOperationPlayerId] = useState<string | null>(null);
  const [modalConfirmKey, setModalConfirmKey] = useState<string | null>(null);
  const [modalBusyKey, setModalBusyKey] = useState<string | null>(null);

  function chargeGroupsForPlayer(
    playerId: string,
    opts: { cancelled?: boolean } = {},
  ): { period: AccountingDuesBillingPeriod; group: ChargeGroup }[] {
    const wantCancelled = opts.cancelled ?? false;
    return periods
      .map((period) => {
        const charge = charges.find((c) => c.player_id === playerId && c.billing_period_id === period.id && Boolean(c.cancelled_at) === wantCancelled);
        if (!charge) return null;
        const group = groupsForPeriod(period.id, { cancelled: wantCancelled }).find((g) => g.groupKey === charge.group_key);
        return group ? { period, group } : null;
      })
      .filter((x): x is { period: AccountingDuesBillingPeriod; group: ChargeGroup } => x !== null);
  }

  async function handleCancelChargeInModal(periodId: string, group: ChargeGroup) {
    const key = `cancel:${periodId}:${group.groupKey}`;
    if (modalConfirmKey !== key) {
      setModalConfirmKey(key);
      setTimeout(() => setModalConfirmKey((cur) => (cur === key ? null : cur)), 3000);
      return;
    }
    setModalBusyKey(key);
    const error = await softCancelCharges(group.chargeIds);
    setModalBusyKey(null);
    if (error) {
      toast.error(`取り消しに失敗しました: ${error}`);
      return;
    }
    toast.success("この請求を取り消しました");
    setModalConfirmKey(null);
  }

  async function handleRestoreChargeInModal(periodId: string, group: ChargeGroup) {
    const key = `restore:${periodId}:${group.groupKey}`;
    if (modalConfirmKey !== key) {
      setModalConfirmKey(key);
      setTimeout(() => setModalConfirmKey((cur) => (cur === key ? null : cur)), 3000);
      return;
    }
    setModalBusyKey(key);
    const error = await restoreCharges(group.chargeIds);
    setModalBusyKey(null);
    if (error) {
      toast.error(`復元に失敗しました: ${error}`);
      return;
    }
    toast.success("この請求を復元しました");
    setModalConfirmKey(null);
  }

  const [bulkChecking, setBulkChecking] = useState<string | null>(null);
  async function handleBulkCheck(periodId: string) {
    setBulkChecking(periodId);
    const supabase = createClient();
    const unpaidIds = charges.filter((c) => c.billing_period_id === periodId && c.status === "unpaid" && !c.cancelled_at).map((c) => c.id);
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
                    <button
                      type="button"
                      onClick={() => setOperationPlayerId(player.id)}
                      aria-label={`${playerFullName(player)}の対象外設定・請求の取消を操作`}
                      className="text-left underline decoration-dotted decoration-ink-soft underline-offset-2"
                    >
                      {playerFullName(player)}
                    </button>
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
          「済」は入金済み、「未」は請求済み・未入金、「－」は請求なし(対象外の選手は「対象外」と表示)。「済」「未」をタップすると入金状態を変更できます。
          選手名をタップすると、対象外の設定やこの項目の請求の個別取消ができます。
        </p>
      </div>

      {operationPlayerId && (() => {
        const player = roster.find((p) => p.id === operationPlayerId);
        if (!player) return null;
        const exempt = settingForPlayer(player.id)?.exempt ?? false;
        const rows = chargeGroupsForPlayer(player.id);
        const cancelledRows = chargeGroupsForPlayer(player.id, { cancelled: true });
        return (
          <Modal
            open={operationPlayerId !== null}
            onClose={() => { setOperationPlayerId(null); setModalConfirmKey(null); }}
            title={`${playerFullName(player)}の操作`}
          >
            <div>
              <button
                type="button"
                onClick={() => handleToggleExempt(player.id)}
                disabled={exemptToggling !== null}
                className={`w-full text-center py-2 rounded-lg font-bold text-[12.5px] border disabled:opacity-50 ${
                  exempt ? "border-orange text-orange-text bg-orange/8" : "border-line text-ink-soft bg-paper"
                }`}
              >
                {exemptToggling === player.id ? "更新中…" : exempt ? "対象外を解除する" : "この集金項目を対象外に設定する"}
              </button>
              <p className="text-[10.5px] text-ink-soft mt-1.5">
                今後の請求作成に反映されます(学年帯等で元々請求が作られない選手でも、対象外であることを明示できます)。
                既に作成済みの請求は自動的には変わりません。誤って作成された請求は下の一覧から個別に取り消せます(取り消した請求は後からいつでも復元できます)。
              </p>
            </div>
            <div className="border-t border-line mt-4 pt-3">
              <div className="text-[11px] font-bold text-ink-soft mb-2">この集金項目の請求一覧</div>
              {rows.length === 0 ? (
                <p className="text-[12px] text-ink-soft">請求はありません。</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {rows.map(({ period, group }) => {
                    const key = `cancel:${period.id}:${group.groupKey}`;
                    return (
                      <li key={key} className="flex items-center justify-between gap-2 text-[12px]">
                        <span>
                          {duesPeriodLabel({ periodStart: period.period_start, periodEnd: period.period_end })}
                          <span className={`ml-2 font-bold ${group.allPaid ? "text-green-text" : "text-orange-text"}`}>
                            {group.allPaid ? "済" : "未"}
                          </span>
                          <span className="text-ink-soft ml-1">({formatYen(group.amount)})</span>
                        </span>
                        <button
                          type="button"
                          disabled={modalBusyKey === key}
                          onClick={() => handleCancelChargeInModal(period.id, group)}
                          className="flex-none px-2.5 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap disabled:opacity-50 bg-white"
                          style={{ color: "var(--danger-text)", borderColor: "var(--danger)" }}
                        >
                          {modalBusyKey === key ? "取消中…" : modalConfirmKey === key ? "もう一度タップで取消確定" : "この請求を取り消す"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {cancelledRows.length > 0 && (
              <div className="border-t border-line mt-4 pt-3">
                <div className="text-[11px] font-bold text-ink-soft mb-2">取り消した請求</div>
                <ul className="flex flex-col gap-2">
                  {cancelledRows.map(({ period, group }) => {
                    const key = `restore:${period.id}:${group.groupKey}`;
                    return (
                      <li key={key} className="flex items-center justify-between gap-2 text-[12px]">
                        <span>
                          {duesPeriodLabel({ periodStart: period.period_start, periodEnd: period.period_end })}
                          <span className="ml-2 font-bold text-ink-soft">取消済み</span>
                          <span className="text-ink-soft ml-1">({formatYen(group.amount)})</span>
                        </span>
                        <button
                          type="button"
                          disabled={modalBusyKey === key}
                          onClick={() => handleRestoreChargeInModal(period.id, group)}
                          className="flex-none px-2.5 py-1 rounded-lg text-[11px] font-bold border border-line whitespace-nowrap disabled:opacity-50 bg-white text-ink-soft"
                        >
                          {modalBusyKey === key ? "復元中…" : modalConfirmKey === key ? "もう一度タップで復元確定" : "復元する"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </Modal>
        );
      })()}

      {periods.length === 0 ? (
        <div className={cardClass}>
          <EmptyState>まだ請求がありません</EmptyState>
        </div>
      ) : (
        <>
          <SectionLabel>入金状況の一括操作・修正</SectionLabel>
          <div className={cardClass}>
            <div className="text-[11px] text-ink-soft mb-2">
              期間を選ぶと、その期間の未納分をまとめてチェックしたり、特定の選手の請求だけを取り消したりできます(選手ごとの入金済み/未納の切り替えは上の表のセルで行えます)。
            </div>
            <select
              className="w-full border border-line rounded-lg p-2 text-[13px] bg-paper"
              value={selectedPeriodId}
              onChange={(e) => {
                setSelectedPeriodId(e.target.value);
                setCorrectionGroupKey("");
                setDeleteConfirming(false);
              }}
            >
              <option value="">期間を選択</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {duesPeriodLabel({ periodStart: p.period_start, periodEnd: p.period_end })}
                </option>
              ))}
            </select>
            {selectedPeriodId &&
              (() => {
                const groups = groupsForPeriod(selectedPeriodId);
                const unpaidCount = groups.filter((g) => !g.allPaid).length;
                if (groups.length === 0) {
                  return <div className="text-[12px] text-ink-soft mt-3">この期間は対象者がいません。</div>;
                }
                return (
                  <>
                    {unpaidCount > 1 && (
                      <button
                        type="button"
                        onClick={() => handleBulkCheck(selectedPeriodId)}
                        disabled={bulkChecking === selectedPeriodId}
                        className="w-full mt-3 text-center py-1.5 rounded-lg font-bold text-[11.5px] border border-line bg-paper text-ink-soft disabled:opacity-50"
                      >
                        未納分をまとめて入金済みにする({unpaidCount}件)
                      </button>
                    )}
                    {/* 一括生成等で在籍していなかった期間にも誤って請求が作られた場合の修正用。 */}
                    <div className="mt-3 border-t border-line pt-3">
                      <div className="text-[11px] text-ink-soft mb-2">
                        在籍していなかった期間など、誤って作られたこの期間の請求だけを選んで取り消します。
                      </div>
                      <select
                        className="w-full border border-line rounded-lg p-2 text-[12px] bg-paper mb-2"
                        value={correctionGroupKey}
                        onChange={(e) => {
                          setCorrectionGroupKey(e.target.value);
                          setDeleteConfirming(false);
                        }}
                      >
                        <option value="">選手を選択</option>
                        {groups.map((g) => (
                          <option key={g.groupKey} value={g.groupKey}>
                            {g.label}({formatYen(g.amount)})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!correctionGroupKey || deletingCharge}
                        onClick={() => handleDeleteCharge(groups.find((g) => g.groupKey === correctionGroupKey)!)}
                        className="w-full px-3 py-1.5 rounded-lg text-[11.5px] font-bold border whitespace-nowrap disabled:opacity-50 bg-white"
                        style={{ color: "var(--danger-text)", borderColor: "var(--danger)" }}
                      >
                        {deletingCharge ? "取消中…" : deleteConfirming ? "もう一度タップで取消確定" : "この請求を取り消す"}
                      </button>
                    </div>
                  </>
                );
              })()}
          </div>
        </>
      )}
    </PageShell>
  );
}
