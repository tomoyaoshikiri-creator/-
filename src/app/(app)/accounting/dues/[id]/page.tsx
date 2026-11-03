"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { EmptyState, SectionLabel, cardClass } from "@/components/ui/Card";
import { FieldLabel, SegButton, inputClass } from "@/components/ui/SegButton";
import { Switch } from "@/components/ui/Switch";
import { ChevronRightIcon, PencilIcon } from "@/components/icons";
import { canManageAccounting } from "@/lib/permissions";
import { hasAccountingAccess } from "@/lib/plan";
import { GRADUATION_GRADE_BY_CATEGORY, MIN_GRADE_BY_CATEGORY } from "@/lib/category";
import { gradeLabel, playerFullName, fiscalYearOf, todayDateStr } from "@/lib/format";
import { FISCAL_MONTHS, sortedCollectionMonths } from "@/lib/duesAnnualSchedule";
import { calculateDuesInstallments } from "@/lib/duesRatePlan";
import {
  DUES_BILLING_UNIT_LABELS,
  DUES_CYCLE_MONTHS_LABELS,
  DUES_CYCLE_MONTHS_OPTIONS,
  DUES_PAYMENT_METHOD_LABELS,
  DUES_PAYMENT_METHOD_OPTIONS,
  DUES_PRICING_METHOD_LABELS,
  formatYen,
  type DuesBillingUnit,
  type DuesCycleMonths,
  type DuesPaymentMethod,
  type DuesPricingMethod,
} from "@/lib/accounting";
import type {
  AccountingCategory,
  AccountingDuesGradeBand,
  AccountingDuesItem,
  AccountingDuesPlayerSetting,
  Database,
  RosterPlayer,
  TeamCategory,
} from "@/lib/database.types";

type DuesItemPatch = Database["public"]["Tables"]["accounting_dues_items"]["Update"];
type DuesPlayerSettingPatch = Database["public"]["Tables"]["accounting_dues_player_settings"]["Update"];

// 学年帯の選択肢(絶対値スケール)。小学生のみ0(未就学)を含める(gradeLabelの扱いと揃える)。
function gradeOptions(category: TeamCategory): number[] {
  const min = MIN_GRADE_BY_CATEGORY[category];
  const max = GRADUATION_GRADE_BY_CATEGORY[category];
  if (min === null || max === null) return [];
  const base = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return category === "小学生" ? [0, ...base] : base;
}

export default function AccountingDuesItemPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { role, plan, category } = useSession();
  const toast = useToast();

  useEffect(() => {
    if (!canManageAccounting(role) || !hasAccountingAccess(plan)) router.replace("/accounting");
  }, [role, plan, router]);

  const [item, setItem] = useState<AccountingDuesItem | null>(null);
  const [draftItem, setDraftItem] = useState<AccountingDuesItem | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState({
    basis: "monthly" as "monthly" | "yearly",
    amount: "",
    months: [4, 7, 10, 1] as number[],
    joinLeave: "prorated" as "prorated" | "full",
  });
  const [incomeCategories, setIncomeCategories] = useState<AccountingCategory[]>([]);
  const [bands, setBands] = useState<AccountingDuesGradeBand[]>([]);
  const [draftBands, setDraftBands] = useState<AccountingDuesGradeBand[]>([]);
  const [playerSettings, setPlayerSettings] = useState<AccountingDuesPlayerSetting[]>([]);
  const [draftPlayerSettings, setDraftPlayerSettings] = useState<AccountingDuesPlayerSetting[]>([]);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: itemRow }, { data: cats }, { data: bandRows }, { data: settingRows }, { data: players }] = await Promise.all([
      supabase.from("accounting_dues_items").select("*").eq("id", params.id).maybeSingle(),
      supabase.from("accounting_categories").select("*").eq("kind", "income").eq("auto_managed", false).order("position", { ascending: true }),
      supabase.from("accounting_dues_grade_bands").select("*").eq("dues_item_id", params.id).order("grade_min", { ascending: true }),
      supabase.from("accounting_dues_player_settings").select("*").eq("dues_item_id", params.id),
      supabase.rpc("list_roster_players"),
    ]);
    if (!itemRow) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setItem(itemRow);
    setDraftItem(itemRow);
    setScheduleDraft({
      basis: itemRow.rate_basis ?? "monthly",
      amount: String((itemRow.rate_basis === "yearly" ? itemRow.flat_yearly_amount : itemRow.flat_monthly_amount) ?? ""),
      months: itemRow.collection_months ?? [4, 7, 10, 1],
      joinLeave: itemRow.join_leave_rule ?? "prorated",
    });
    setIncomeCategories(cats ?? []);
    setBands(bandRows ?? []);
    setDraftBands(bandRows ?? []);
    setPlayerSettings(settingRows ?? []);
    setDraftPlayerSettings(settingRows ?? []);
    setRoster(players ?? []);
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  // 項目設定は編集モードで下書きに保持し、保存時に一括更新する。
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  function handleSave(patch: DuesItemPatch) {
    setDraftItem(prev => prev ? ({ ...prev, ...patch } as AccountingDuesItem) : prev);
  }
  function cancelEditing() {
    if (!item) return;
    setDraftItem({ ...item });
    setDraftBands(bands.map(b => ({ ...b })));
    setDraftPlayerSettings(playerSettings.map(p => ({ ...p })));
    setScheduleDraft({
      basis: item.rate_basis ?? "monthly",
      amount: String((item.rate_basis === "yearly" ? item.flat_yearly_amount : item.flat_monthly_amount) ?? ""),
      months: item.collection_months ?? [4, 7, 10, 1],
      joinLeave: item.join_leave_rule ?? "prorated",
    });
    setEditing(false);
  }
  async function saveAll() {
    if (!item || !draftItem || saving) return;
    if (!draftItem.name.trim()) { toast.warning("名称を入力してください"); return; }
    const scheduleChanged = JSON.stringify(sortedCollectionMonths(scheduleDraft.months)) !== JSON.stringify(sortedCollectionMonths(item.collection_months ?? [4,7,10,1]))
      || scheduleDraft.basis !== (item.rate_basis ?? "monthly")
      || scheduleDraft.joinLeave !== (item.join_leave_rule ?? "prorated");
    const scheduleAmount = Number(scheduleDraft.amount);
    const amountChanged = scheduleDraft.basis === "yearly"
      ? scheduleAmount !== Number(item.flat_yearly_amount ?? 0)
      : scheduleAmount !== Number(item.flat_monthly_amount ?? 0);
    const scheduleNeedsSave = scheduleChanged || (draftItem.pricing_method === "flat" && amountChanged)
      || (item.schedule_mode !== "configured" && scheduleChanged);
    if (scheduleNeedsSave) {
      if (scheduleDraft.months.length === 0 || !Number.isInteger(scheduleAmount) || scheduleAmount < 0) {
        toast.warning("集金月と料金を正しく設定してください");
        return;
      }
      if (draftItem.pricing_method === "flat" && scheduleAmount <= 0) {
        toast.warning("月額または年額は1円以上で設定してください");
        return;
      }
      if (draftItem.pricing_method === "grade_band" && scheduleDraft.basis === "yearly") {
        toast.warning("学年帯別料金は月額基準で設定してください");
        return;
      }
    }
    setSaving(true);
    const bandsChanged = JSON.stringify(draftBands) !== JSON.stringify(bands);
    const playersChanged = JSON.stringify(draftPlayerSettings) !== JSON.stringify(playerSettings);
    if (bandsChanged || playersChanged || scheduleNeedsSave || draftItem.pricing_method !== item.pricing_method) {
      const supabase = createClient();
      const { count, error: historyError } = await supabase.from("accounting_dues_billing_periods")
        .select("id", { count: "exact", head: true }).eq("dues_item_id", item.id)
        .eq("fiscal_year", fiscalYearOf(todayDateStr()));
      if (historyError || (count ?? 0) > 0) {
        setSaving(false);
        toast.warning(historyError ? "請求履歴を確認できませんでした" : "今年度に請求済みのため学年帯を変更できません");
        return;
      }
      for (const oldBand of bands) {
        if (!draftBands.some(b => b.id === oldBand.id)) {
          const { error } = await supabase.from("accounting_dues_grade_bands").delete().eq("id", oldBand.id);
          if (error) { setSaving(false); toast.error("学年帯の削除に失敗しました"); await load(); return; }
        }
      }
      for (const band of draftBands.filter(b => b.id.startsWith("draft-"))) {
        const { error } = await supabase.from("accounting_dues_grade_bands").insert({
          dues_item_id: item.id, grade_min: band.grade_min, grade_max: band.grade_max,
          monthly_amount: band.monthly_amount,
        });
        if (error) { setSaving(false); toast.error("学年帯の追加に失敗しました"); await load(); return; }
      }
    }
    if (playersChanged) {
      const supabase = createClient();
      for (const original of playerSettings) {
        if (!draftPlayerSettings.some(p => p.id === original.id)) {
          const { error } = await supabase.from("accounting_dues_player_settings").delete().eq("id", original.id);
          if (error) { setSaving(false); toast.error("選手別設定の削除に失敗しました"); await load(); return; }
        }
      }
      for (const p of draftPlayerSettings) {
        const old = playerSettings.find(x => x.id === p.id);
        if (old && JSON.stringify(old) === JSON.stringify(p)) continue;
        const patch = { monthly_amount: p.monthly_amount, exempt: p.exempt,
          start_date: p.start_date, stop_date: p.stop_date, note: p.note };
        const { error } = old
          ? await supabase.from("accounting_dues_player_settings").update(patch).eq("id", p.id)
          : await supabase.from("accounting_dues_player_settings").insert({ ...patch, dues_item_id: item.id, player_id: p.player_id });
        if (error) { setSaving(false); toast.error("選手別設定の保存に失敗しました"); await load(); return; }
      }
    }
    const { data, error } = await createClient().from("accounting_dues_items")
      .update({
        name: draftItem.name.trim(), active: draftItem.active,
        pricing_method: draftItem.pricing_method,
        flat_monthly_amount: draftItem.flat_monthly_amount,
        cycle_months: draftItem.cycle_months,
        payment_methods: draftItem.payment_methods,
        billing_unit: draftItem.billing_unit,
        income_category_id: draftItem.income_category_id,
        reminder_days_after: draftItem.reminder_days_after,
        ...(scheduleNeedsSave ? {
          schedule_mode: "configured" as const,
          rate_basis: scheduleDraft.basis,
          collection_months: sortedCollectionMonths(scheduleDraft.months),
          join_leave_rule: scheduleDraft.joinLeave,
          ...(draftItem.pricing_method === "flat" ? (scheduleDraft.basis === "yearly"
            ? { flat_yearly_amount: scheduleAmount }
            : { flat_monthly_amount: scheduleAmount }) : {}),
        } : {}),
        updated_at: new Date().toISOString(),
      }).eq("id", item.id).select("*").single();
    setSaving(false);
    if (error || !data) { toast.error(`保存に失敗しました: ${error?.message ?? ""}`); return; }
    setItem(data);
    setDraftItem(data);
    await load();
    setEditing(false);
    toast.success("設定を保存しました");
  }
  function togglePaymentMethod(method: DuesPaymentMethod) {
    const current = (draftItem?.payment_methods ?? []) as DuesPaymentMethod[];
    handleSave({ payment_methods: current.includes(method)
      ? current.filter(m => m !== method) : [...current, method] });
  }

  // 削除
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  async function handleDelete() {
    if (!item) return;
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(false), 3000);
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("accounting_dues_items").delete().eq("id", item.id);
    if (error) {
      toast.error(`削除に失敗しました: ${error.message}`);
      return;
    }
    router.push("/accounting/dues");
  }

  // 学年帯の追加
  const grades = gradeOptions(category);
  const [bandDraft, setBandDraft] = useState({ grade_min: grades[0] ?? 0, grade_max: grades[0] ?? 0, monthly_amount: "" });
  function handleAddBand() {
    if (!item) return;
    const amount = Number(bandDraft.monthly_amount);
    if (bandDraft.grade_min > bandDraft.grade_max || !Number.isFinite(amount) || amount <= 0) {
      toast.warning("学年の範囲・月額を正しく入力してください"); return;
    }
    setDraftBands(prev => [...prev, {
      id: `draft-${crypto.randomUUID()}`, dues_item_id: item.id,
      grade_min: bandDraft.grade_min, grade_max: bandDraft.grade_max,
      monthly_amount: amount,
    } as AccountingDuesGradeBand].sort((x,y) => x.grade_min-y.grade_min));
    setBandDraft({ grade_min: grades[0] ?? 0, grade_max: grades[0] ?? 0, monthly_amount: "" });
  }
  function handleDeleteBand(id: string) {
    setDraftBands(prev => prev.filter(b => b.id !== id));
  }

  // 選手ごとの個別設定の追加・編集
  const visiblePlayerSettings = editing ? draftPlayerSettings : playerSettings;
  const settingPlayerIds = new Set(visiblePlayerSettings.map(s => s.player_id));
  const candidates = roster.filter(p => !settingPlayerIds.has(p.id));
  const [newPlayerId, setNewPlayerId] = useState("");
  function handleAddPlayerSetting() {
    if (!item || !newPlayerId) return;
    setDraftPlayerSettings(prev => [...prev, {
      id: `draft-${crypto.randomUUID()}`, dues_item_id: item.id, player_id: newPlayerId,
      monthly_amount: null, exempt: false, start_date: null, stop_date: null, note: null,
    } as AccountingDuesPlayerSetting]);
    setNewPlayerId("");
  }
  function handleUpdatePlayerSetting(id: string, patch: DuesPlayerSettingPatch) {
    setDraftPlayerSettings(prev => prev.map(p => p.id === id ? ({ ...p, ...patch } as AccountingDuesPlayerSetting) : p));
  }
  function handleDeletePlayerSetting(id: string) {
    setDraftPlayerSettings(prev => prev.filter(p => p.id !== id));
  }

  if (loading) {
    return (
      <PageShell header={<AppHeader title="集金項目" variant="detail" backHref="/accounting/dues" accessBadge="operations" />}>
        <EmptyState>読み込み中…</EmptyState>
      </PageShell>
    );
  }
  if (notFound || !item) {
    return (
      <PageShell header={<AppHeader title="集金項目" variant="detail" backHref="/accounting/dues" accessBadge="operations" />}>
        <div className={cardClass}>
          <EmptyState>この集金項目は見つかりませんでした</EmptyState>
        </div>
      </PageShell>
    );
  }

  let installmentPreview: ReturnType<typeof calculateDuesInstallments> | null = null;
  try {
    installmentPreview = calculateDuesInstallments({ basis: scheduleDraft.basis, amount: Number(scheduleDraft.amount), collectionMonths: scheduleDraft.months });
  } catch {
    installmentPreview = null;
  }

  const currentItem = editing ? (draftItem ?? item) : item;
  const pricingMethod = currentItem.pricing_method as DuesPricingMethod;
  const paymentMethods = currentItem.payment_methods as DuesPaymentMethod[];

  // 設定する順番がわかるよう、画面に出てくるカードへ上から通し番号を振る
  // (ユーザーから「1画面に項目が多すぎて設定する順番がわからない」と指摘を受けた改善)。
  // 学年帯カードは料金の決め方によって出たり消えたりするため、固定の数字ではなく
  // レンダー中にインクリメントするカウンタで採番する。
  let stepNumber = 0;
  const step = (text: string) => `${++stepNumber}. ${text}`;

  return (
    <PageShell header={<AppHeader title={currentItem.name} variant="detail" backHref="/accounting/dues" accessBadge="operations" />}>
      <Link href={`/accounting/dues/${item.id}/checklist`}>
        <div className={`${cardClass} cursor-pointer mb-2.5`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-[14px]">入金チェック</div>
              <div className="text-[11px] text-ink-soft mt-0.5">請求の作成状況・入金状況を確認する</div>
            </div>
            <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
          </div>
        </div>
      </Link>

      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[12px] text-ink-soft">{editing ? "編集中" : "閲覧モード"}</span>
        {!editing && (
          <button type="button" onClick={() => { setDraftItem({ ...item }); setDraftBands(bands.map(b => ({ ...b }))); setDraftPlayerSettings(playerSettings.map(p => ({ ...p }))); setEditing(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold text-[12px] text-ink-soft hover:bg-line/40">
            <PencilIcon className="w-3.5 h-3.5" aria-hidden="true" /> 編集
          </button>
        )}
      </div>

      <SectionLabel>{step("名称・状態")}</SectionLabel>
      <div className={cardClass}>
        {editing ? (
          <>
            <FieldLabel>名称</FieldLabel>
            <input
              className={inputClass()}
              defaultValue={currentItem.name}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== currentItem.name) handleSave({ name: v });
              }}
            />
            <div className="flex items-center justify-between mt-2.5">
              <FieldLabel>有効</FieldLabel>
              <Switch checked={currentItem.active} onChange={(v) => handleSave({ active: v })} disabled={saving} />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between">
            <span className="font-bold text-[14px]">{currentItem.name}</span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-none ${
                currentItem.active ? "bg-green/10 text-green-text" : "bg-line text-ink-soft"
              }`}
            >
              {currentItem.active ? "有効" : "停止中"}
            </span>
          </div>
        )}
      </div>

      <SectionLabel>{step("料金の決め方")}</SectionLabel>
      <div className={cardClass}>
        {editing ? (
          <>
            <div className="flex flex-col gap-1.5">
              {(Object.keys(DUES_PRICING_METHOD_LABELS) as DuesPricingMethod[]).map((m) => (
                <SegButton key={m} active={pricingMethod === m} onClick={() => handleSave({ pricing_method: m })}>
                  {DUES_PRICING_METHOD_LABELS[m]}
                </SegButton>
              ))}
            </div>
            {pricingMethod === "flat" && (
              <div className="mt-2.5">
                <FieldLabel>月額</FieldLabel>
                <input
                  type="number"
                  min={1}
                  className={inputClass()}
                  defaultValue={item.flat_monthly_amount ?? ""}
                  onBlur={(e) => {
                    const amount = Number(e.target.value);
                    if (Number.isFinite(amount) && amount > 0 && amount !== item.flat_monthly_amount) {
                      handleSave({ flat_monthly_amount: amount });
                    }
                  }}
                />
              </div>
            )}
            {pricingMethod === "grade_band" && (
              <div className="mt-2.5 text-[11.5px] text-ink-soft">学年帯ごとの月額は、次のステップで設定します。</div>
            )}
            {pricingMethod === "per_player" && (
              <div className="mt-2.5 text-[11.5px] text-ink-soft">選手ごとの月額は、次のステップで全員分を設定します。</div>
            )}
          </>
        ) : (
          <div>
            <div className="text-[13px] font-bold">{DUES_PRICING_METHOD_LABELS[pricingMethod]}</div>
            {pricingMethod === "flat" && (
              <div className="text-[12px] text-ink-soft mt-1">月額 {formatYen(Number(item.flat_monthly_amount ?? 0))}</div>
            )}
            {pricingMethod === "grade_band" && <div className="text-[12px] text-ink-soft mt-1">学年帯ごとの月額は下のカードで設定します。</div>}
            {pricingMethod === "per_player" && <div className="text-[12px] text-ink-soft mt-1">選手ごとの月額は下のカードで設定します。</div>}
          </div>
        )}
      </div>

      {pricingMethod === "grade_band" && (
        <>
          <SectionLabel>{step("学年帯ごとの月額")}</SectionLabel>
          <div className={cardClass}>
            {(editing ? draftBands : bands).length === 0 ? (
              <EmptyState>まだ学年帯が設定されていません</EmptyState>
            ) : (
              <ul>
                {(editing ? draftBands : bands).map((b) => (
                  <li key={b.id} className="flex items-center justify-between py-2 border-b border-line last:border-b-0">
                    <span className="text-[13px] font-bold">
                      {gradeLabel(String(b.grade_min), category)}〜{gradeLabel(String(b.grade_max), category)}: {formatYen(Number(b.monthly_amount))}/月
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteBand(b.id)}
                      disabled={!editing}
                      className="flex-none px-2.5 py-1 rounded-lg text-[11px] font-bold border border-line text-ink-soft bg-paper disabled:hidden"
                    >
                      削除
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {editing && grades.length > 0 && (
              <div className={(editing ? draftBands : bands).length > 0 ? "mt-2.5 flex flex-col gap-1.5" : "flex flex-col gap-1.5"}>
                <div className="flex items-center gap-1.5">
                  <select
                    className={inputClass("flex-1")}
                    value={bandDraft.grade_min}
                    onChange={(e) => setBandDraft((d) => ({ ...d, grade_min: Number(e.target.value) }))}
                  >
                    {grades.map((g) => (
                      <option key={g} value={g}>
                        {gradeLabel(String(g), category)}
                      </option>
                    ))}
                  </select>
                  <span className="text-[12px] text-ink-soft flex-none">〜</span>
                  <select
                    className={inputClass("flex-1")}
                    value={bandDraft.grade_max}
                    onChange={(e) => setBandDraft((d) => ({ ...d, grade_max: Number(e.target.value) }))}
                  >
                    {grades.map((g) => (
                      <option key={g} value={g}>
                        {gradeLabel(String(g), category)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-24 flex-none">
                    <input
                      type="number"
                      min={1}
                      placeholder="月額"
                      className={inputClass()}
                      value={bandDraft.monthly_amount}
                      onChange={(e) => setBandDraft((d) => ({ ...d, monthly_amount: e.target.value }))}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddBand}
                    className="flex-1 px-3 py-2 rounded-lg font-bold text-[12px] border border-orange text-orange-text bg-orange/8"
                  >
                    追加
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <SectionLabel>{step("選手ごとの個別設定")}</SectionLabel>
      <div className="text-[11.5px] text-ink-soft mb-2">
        {pricingMethod === "per_player"
          ? "この項目は選手ごとに金額を指定する方式のため、ここで全員分の月額を設定してください。"
          : "免除・金額の上書き・請求開始/停止月が必要な選手だけ、ここで設定します。"}
      </div>
      <div className={cardClass}>
        {visiblePlayerSettings.length === 0 ? (
          <EmptyState>まだ個別設定がありません</EmptyState>
        ) : (
          <ul>
            {visiblePlayerSettings.map((s) => {
              const player = roster.find((p) => p.id === s.player_id);
              return (
                <li key={s.id} className="py-2.5 border-b border-line last:border-b-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[13px]">{player ? playerFullName(player) : "(卒団済みなどの選手)"}</span>
                    <button
                      type="button"
                      onClick={() => handleDeletePlayerSetting(s.id)}
                      disabled={!editing}
                      className="flex-none px-2.5 py-1 rounded-lg text-[11px] font-bold border border-line text-ink-soft bg-paper"
                    >
                      削除
                    </button>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      disabled={!editing}
                      type="number"
                      min={0}
                      placeholder={pricingMethod === "per_player" ? "月額(必須)" : "月額の上書き(任意)"}
                      className={inputClass("flex-1")}
                      defaultValue={s.monthly_amount ?? ""}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        const amount = v === "" ? null : Number(v);
                        if (amount === null || (Number.isFinite(amount) && amount >= 0)) handleUpdatePlayerSetting(s.id, { monthly_amount: amount });
                      }}
                    />
                    <label className="flex-none flex items-center gap-1 text-[12px] font-bold text-ink-soft">
                      <input
                        disabled={!editing}
                        type="checkbox"
                        checked={s.exempt}
                        onChange={(e) => handleUpdatePlayerSetting(s.id, { exempt: e.target.checked })}
                      />
                      免除
                    </label>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1">
                      <div className="text-[10.5px] text-ink-soft mb-0.5">開始月(任意)</div>
                      <input
                        disabled={!editing}
                        type="date"
                        className={inputClass()}
                        defaultValue={s.start_date ?? ""}
                        onBlur={(e) => handleUpdatePlayerSetting(s.id, { start_date: e.target.value || null })}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="text-[10.5px] text-ink-soft mb-0.5">停止月(任意)</div>
                      <input
                        type="date"
                        className={inputClass()}
                        defaultValue={s.stop_date ?? ""}
                        onBlur={(e) => handleUpdatePlayerSetting(s.id, { stop_date: e.target.value || null })}
                      />
                    </div>
                  </div>
                  <input
                    disabled={!editing}
                    className={inputClass("mt-1.5")}
                    placeholder="備考(任意)"
                    defaultValue={s.note ?? ""}
                    onBlur={(e) => handleUpdatePlayerSetting(s.id, { note: e.target.value.trim() || null })}
                  />
                </li>
              );
            })}
          </ul>
        )}
        {editing && candidates.length > 0 && (
          <div className={visiblePlayerSettings.length > 0 ? "mt-2.5 flex gap-2" : "flex gap-2"}>
            <select className={inputClass("flex-1")} value={newPlayerId} onChange={(e) => setNewPlayerId(e.target.value)}>
              <option value="">選手を選ぶ</option>
              {candidates.map((p) => (
                <option key={p.id} value={p.id}>
                  {playerFullName(p)}({gradeLabel(p.grade, category)})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddPlayerSetting}
              disabled={!newPlayerId}
              className="flex-none px-3.5 rounded-lg font-bold text-[12.5px] border border-orange text-orange-text bg-orange/8 disabled:opacity-50"
            >
              追加
            </button>
          </div>
        )}
      </div>

      <SectionLabel>{step("集金月・集金予定額")}</SectionLabel>
      <div className={cardClass}>
        <div className="text-[11.5px] text-ink-soft mb-2">月額と集金月を分けて設定します。設定変更は保存時に反映します。今年度の請求履歴がある場合、集金月・料金方式の変更はできません。</div>
        <div className="text-[12px] font-bold mb-1">料金基準</div>
        <div className="flex gap-2">
          {([["monthly", "月額"], ["yearly", "年額"]] as const).map(([basis, label]) => (
            <SegButton key={basis} active={scheduleDraft.basis === basis} onClick={() => editing && setScheduleDraft(d => ({
              ...d, basis, amount: String((basis === "yearly" ? item.flat_yearly_amount : item.flat_monthly_amount) ?? ""),
            }))}>{label}</SegButton>
          ))}
        </div>
        {pricingMethod === "flat" && <div className="mt-2">
          <FieldLabel>{scheduleDraft.basis === "monthly" ? "月額（円）" : "年額（円）"}</FieldLabel>
          <input type="number" min={1} step={1} disabled={!editing} className={inputClass()} value={scheduleDraft.amount}
            onChange={e => setScheduleDraft(d => ({ ...d, amount: e.target.value }))} />
        </div>}
        <div className="mt-3">
          <FieldLabel>集金月（複数選択可）</FieldLabel>
          <div className="grid grid-cols-4 gap-1.5">
            {FISCAL_MONTHS.map(month => (
              <SegButton key={month} active={scheduleDraft.months.includes(month)} onClick={() => editing && setScheduleDraft(d => ({
                ...d, months: d.months.includes(month) ? d.months.filter(m => m !== month) : sortedCollectionMonths([...d.months, month]),
              }))}>{month}月</SegButton>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <FieldLabel>途中加入・退団</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {([["prorated", "在籍月数分"], ["full", "対象期間の全額"]] as const).map(([rule, label]) => (
              <SegButton key={rule} active={scheduleDraft.joinLeave === rule} onClick={() => editing && setScheduleDraft(d => ({ ...d, joinLeave: rule }))}>{label}</SegButton>
            ))}
          </div>
        </div>
        {pricingMethod === "flat" && installmentPreview ? (
          <div className="mt-3 rounded-lg bg-line/30 p-2.5">
            <div className="text-[12px] font-bold mb-1">集金予定額</div>
            {installmentPreview.map(row => <div key={row.month} className="flex justify-between text-[12px] py-1"><span>{row.month}月（{row.coveredMonths.length}か月）</span><span>{formatYen(row.amount)}</span></div>)}
            <div className="border-t border-line mt-1 pt-2 text-[13px] font-bold">年間 {formatYen(installmentPreview.reduce((sum, row) => sum + row.amount, 0))}</div>
          </div>
        ) : pricingMethod === "grade_band" && scheduleDraft.basis === "monthly" ? (
          <div className="mt-3 rounded-lg bg-line/30 p-2.5">
            <div className="text-[12px] font-bold mb-1">学年帯別の集金予定額（参考）</div>
            {(editing ? draftBands : bands).map(b => {
              let rows: ReturnType<typeof calculateDuesInstallments> = [];
              try { rows = calculateDuesInstallments({ basis: "monthly", amount: Number(b.monthly_amount), collectionMonths: scheduleDraft.months }); } catch { /* 集金月未設定 */ }
              return <div key={b.id} className="py-2 border-b border-line last:border-b-0">
                <div className="text-[12px] font-bold">{gradeLabel(String(b.grade_min), category)}〜{gradeLabel(String(b.grade_max), category)}：月額 {formatYen(Number(b.monthly_amount))}</div>
                {rows.map(row => <div key={row.month} className="flex justify-between text-[11px] py-0.5"><span>{row.month}月（{row.coveredMonths.length}か月分）</span><span>{formatYen(row.amount)}</span></div>)}
              </div>;
            })}
          </div>
        ) : <div className="mt-2 text-[11px] text-ink-soft">料金と集金月を設定すると試算を表示します。</div>}
        <div className="mt-1 text-[11px] text-ink-soft">現在の方式：{item.schedule_mode === "configured" ? "新方式" : "従来方式"}</div>
      </div>

      <SectionLabel>{step("集金の設定")}</SectionLabel>
      <div className={cardClass}>
        {editing ? (
          <>
            <FieldLabel>集金の周期</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {DUES_CYCLE_MONTHS_OPTIONS.map((c) => (
                <SegButton key={c} active={currentItem.cycle_months === c} onClick={() => handleSave({ cycle_months: c })}>
                  {DUES_CYCLE_MONTHS_LABELS[c as DuesCycleMonths]}
                </SegButton>
              ))}
            </div>
            <div className="mt-2.5">
              <FieldLabel>支払い方法(複数選択可)</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {DUES_PAYMENT_METHOD_OPTIONS.map((m) => (
                  <SegButton key={m} active={paymentMethods.includes(m)} onClick={() => togglePaymentMethod(m)}>
                    {DUES_PAYMENT_METHOD_LABELS[m]}
                  </SegButton>
                ))}
              </div>
            </div>
            <div className="mt-2.5">
              <FieldLabel>請求の単位</FieldLabel>
              <div className="flex gap-1.5">
                {(Object.keys(DUES_BILLING_UNIT_LABELS) as DuesBillingUnit[]).map((u) => (
                  <SegButton key={u} active={currentItem.billing_unit === u} onClick={() => handleSave({ billing_unit: u })}>
                    {DUES_BILLING_UNIT_LABELS[u]}
                  </SegButton>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-1.5 text-[12.5px]">
            <div>
              <span className="text-ink-soft">周期: </span>
              <span className="font-bold">{DUES_CYCLE_MONTHS_LABELS[currentItem.cycle_months as DuesCycleMonths]}</span>
            </div>
            <div>
              <span className="text-ink-soft">支払い方法: </span>
              <span className="font-bold">
                {paymentMethods.length > 0 ? paymentMethods.map((m) => DUES_PAYMENT_METHOD_LABELS[m]).join("・") : "未設定"}
              </span>
            </div>
            <div>
              <span className="text-ink-soft">請求の単位: </span>
              <span className="font-bold">{DUES_BILLING_UNIT_LABELS[currentItem.billing_unit as DuesBillingUnit]}</span>
            </div>
          </div>
        )}
      </div>

      <SectionLabel>{step("会計への計上")}</SectionLabel>
      <div className={cardClass}>
        {editing ? (
          <>
            <FieldLabel>計上先の収入項目</FieldLabel>
            <select className={inputClass()} value={currentItem.income_category_id} onChange={(e) => handleSave({ income_category_id: e.target.value })}>
              {incomeCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </>
        ) : (
          <div className="text-[13px] font-bold">
            {incomeCategories.find((c) => c.id === currentItem.income_category_id)?.name ?? "(削除済みの項目)"}
          </div>
        )}
      </div>

      <SectionLabel>{step("未納通知(任意)")}</SectionLabel>
      <div className={cardClass}>
        {editing ? (
          <>
            <div className="text-[11px] text-ink-soft mb-1.5">
              集金期間の開始から何日後に、未納の家庭へ自動でお知らせするか。空欄なら自動送信しません。
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-ink-soft flex-none">開始から</span>
              <div className="w-20 flex-none">
                <input
                  type="number"
                  min={0}
                  className={inputClass()}
                  defaultValue={currentItem.reminder_days_after ?? ""}
                  placeholder="未設定"
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    const days = v === "" ? null : Number(v);
                    if (days === null || (Number.isFinite(days) && days >= 0)) handleSave({ reminder_days_after: days });
                  }}
                />
              </div>
              <span className="text-[12px] text-ink-soft flex-none">日後</span>
            </div>
          </>
        ) : (
          <div className="text-[13px] font-bold">
            {currentItem.reminder_days_after !== null ? `開始から${currentItem.reminder_days_after}日後に自動送信` : "自動送信しない"}
          </div>
        )}
      </div>

      {editing && <div className="sticky bottom-0 z-10 flex gap-2 py-3 bg-paper border-t border-line">
        <button type="button" disabled={saving} onClick={cancelEditing}
          className="flex-1 py-2.5 rounded-lg border border-line font-bold text-[13px]">キャンセル</button>
        <button type="button" disabled={saving} onClick={saveAll}
          className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white font-bold text-[13px]">
          {saving ? "保存中…" : "保存"}
        </button>
      </div>}

      <SectionLabel>削除</SectionLabel>
      <div className={cardClass}>
        <button
          type="button"
          onClick={handleDelete}
          className="w-full text-center py-2 rounded-lg font-bold text-[12.5px] border bg-white"
          style={{ color: "var(--danger-text)", borderColor: "var(--danger)" }}
        >
          {deleteConfirm ? "もう一度タップで削除確定" : "この集金項目を削除"}
        </button>
      </div>
    </PageShell>
  );
}
