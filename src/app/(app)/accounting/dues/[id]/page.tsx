"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { FieldLabel, SegButton, inputClass } from "@/components/ui/SegButton";
import { Switch } from "@/components/ui/Switch";
import { ChevronRightIcon } from "@/components/icons";
import { canManageAccounting } from "@/lib/permissions";
import { hasAccountingAccess } from "@/lib/plan";
import { GRADUATION_GRADE_BY_CATEGORY, MIN_GRADE_BY_CATEGORY } from "@/lib/category";
import { gradeLabel, playerFullName } from "@/lib/format";
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
  const [incomeCategories, setIncomeCategories] = useState<AccountingCategory[]>([]);
  const [bands, setBands] = useState<AccountingDuesGradeBand[]>([]);
  const [playerSettings, setPlayerSettings] = useState<AccountingDuesPlayerSetting[]>([]);
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
    setIncomeCategories(cats ?? []);
    setBands(bandRows ?? []);
    setPlayerSettings(settingRows ?? []);
    setRoster(players ?? []);
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  // 基本設定の編集
  const [saving, setSaving] = useState(false);
  async function handleSave(patch: DuesItemPatch) {
    if (!item) return;
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("accounting_dues_items")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", item.id)
      .select("*")
      .single();
    setSaving(false);
    if (error || !data) {
      toast(`保存に失敗しました: ${error?.message ?? ""}`);
      return;
    }
    setItem(data);
  }

  function togglePaymentMethod(method: DuesPaymentMethod) {
    if (!item) return;
    const current = item.payment_methods as DuesPaymentMethod[];
    const next = current.includes(method) ? current.filter((m) => m !== method) : [...current, method];
    handleSave({ payment_methods: next });
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
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    router.push("/accounting/dues");
  }

  // 学年帯の追加
  const grades = gradeOptions(category);
  const [bandDraft, setBandDraft] = useState({ grade_min: grades[0] ?? 0, grade_max: grades[0] ?? 0, monthly_amount: "" });
  async function handleAddBand() {
    if (!item) return;
    const amount = Number(bandDraft.monthly_amount);
    if (bandDraft.grade_min > bandDraft.grade_max || !Number.isFinite(amount) || amount <= 0) {
      toast("学年の範囲・月額を正しく入力してください");
      return;
    }
    const supabase = createClient();
    const { data, error } = await supabase
      .from("accounting_dues_grade_bands")
      .insert({ dues_item_id: item.id, grade_min: bandDraft.grade_min, grade_max: bandDraft.grade_max, monthly_amount: amount })
      .select("*")
      .single();
    if (error || !data) {
      toast(`追加に失敗しました: ${error?.message ?? ""}`);
      return;
    }
    setBands((prev) => [...prev, data].sort((a, b) => a.grade_min - b.grade_min));
    setBandDraft({ grade_min: grades[0] ?? 0, grade_max: grades[0] ?? 0, monthly_amount: "" });
  }
  async function handleDeleteBand(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("accounting_dues_grade_bands").delete().eq("id", id);
    if (error) {
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    setBands((prev) => prev.filter((b) => b.id !== id));
  }

  // 選手ごとの個別設定の追加・編集
  const settingPlayerIds = new Set(playerSettings.map((s) => s.player_id));
  const candidates = roster.filter((p) => !settingPlayerIds.has(p.id));
  const [newPlayerId, setNewPlayerId] = useState("");
  async function handleAddPlayerSetting() {
    if (!item || !newPlayerId) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("accounting_dues_player_settings")
      .insert({ dues_item_id: item.id, player_id: newPlayerId })
      .select("*")
      .single();
    if (error || !data) {
      toast(`追加に失敗しました: ${error?.message ?? ""}`);
      return;
    }
    setPlayerSettings((prev) => [...prev, data]);
    setNewPlayerId("");
  }
  async function handleUpdatePlayerSetting(id: string, patch: DuesPlayerSettingPatch) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("accounting_dues_player_settings")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) {
      toast(`保存に失敗しました: ${error?.message ?? ""}`);
      return;
    }
    setPlayerSettings((prev) => prev.map((s) => (s.id === id ? data : s)));
  }
  async function handleDeletePlayerSetting(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("accounting_dues_player_settings").delete().eq("id", id);
    if (error) {
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    setPlayerSettings((prev) => prev.filter((s) => s.id !== id));
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
        <Card>
          <EmptyState>この集金項目は見つかりませんでした</EmptyState>
        </Card>
      </PageShell>
    );
  }

  const pricingMethod = item.pricing_method as DuesPricingMethod;
  const paymentMethods = item.payment_methods as DuesPaymentMethod[];

  // 設定する順番がわかるよう、画面に出てくるカードへ上から通し番号を振る
  // (ユーザーから「1画面に項目が多すぎて設定する順番がわからない」と指摘を受けた改善)。
  // 学年帯カードは料金の決め方によって出たり消えたりするため、固定の数字ではなく
  // レンダー中にインクリメントするカウンタで採番する。
  let stepNumber = 0;
  const step = (text: string) => `${++stepNumber}. ${text}`;

  return (
    <PageShell header={<AppHeader title={item.name} variant="detail" backHref="/accounting/dues" accessBadge="operations" />}>
      <Link href={`/accounting/dues/${item.id}/checklist`}>
        <Card className="cursor-pointer mb-2.5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-[14px]">入金チェック</div>
              <div className="text-[11px] text-ink-soft mt-0.5">請求の作成状況・入金状況を確認する</div>
            </div>
            <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
          </div>
        </Card>
      </Link>

      <SectionLabel>{step("名称・状態")}</SectionLabel>
      <Card>
        <FieldLabel>名称</FieldLabel>
        <input
          className={inputClass()}
          defaultValue={item.name}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== item.name) handleSave({ name: v });
          }}
        />
        <div className="flex items-center justify-between mt-2.5">
          <FieldLabel>有効</FieldLabel>
          <Switch checked={item.active} onChange={(v) => handleSave({ active: v })} disabled={saving} />
        </div>
      </Card>

      <SectionLabel>{step("料金の決め方")}</SectionLabel>
      <Card>
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
      </Card>

      {pricingMethod === "grade_band" && (
        <>
          <SectionLabel>{step("学年帯ごとの月額")}</SectionLabel>
          <Card>
            {bands.length === 0 ? (
              <EmptyState>まだ学年帯が設定されていません</EmptyState>
            ) : (
              <ul>
                {bands.map((b) => (
                  <li key={b.id} className="flex items-center justify-between py-2 border-b border-line last:border-b-0">
                    <span className="text-[13px] font-bold">
                      {gradeLabel(String(b.grade_min), category)}〜{gradeLabel(String(b.grade_max), category)}: {formatYen(Number(b.monthly_amount))}/月
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteBand(b.id)}
                      className="flex-none px-2.5 py-1 rounded-lg text-[11px] font-bold border border-line text-ink-soft bg-paper"
                    >
                      削除
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {grades.length > 0 && (
              <div className={bands.length > 0 ? "mt-2.5 flex flex-col gap-1.5" : "flex flex-col gap-1.5"}>
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
                    className="flex-1 px-3 py-2 rounded-lg font-bold text-[12px] border border-orange text-orange bg-orange/8"
                  >
                    追加
                  </button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      <SectionLabel>{step("選手ごとの個別設定")}</SectionLabel>
      <div className="text-[11.5px] text-ink-soft mb-2">
        {pricingMethod === "per_player"
          ? "この項目は選手ごとに金額を指定する方式のため、ここで全員分の月額を設定してください。"
          : "免除・金額の上書き・請求開始/停止月が必要な選手だけ、ここで設定します。"}
      </div>
      <Card>
        {playerSettings.length === 0 ? (
          <EmptyState>まだ個別設定がありません</EmptyState>
        ) : (
          <ul>
            {playerSettings.map((s) => {
              const player = roster.find((p) => p.id === s.player_id);
              return (
                <li key={s.id} className="py-2.5 border-b border-line last:border-b-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[13px]">{player ? playerFullName(player) : "(卒団済みなどの選手)"}</span>
                    <button
                      type="button"
                      onClick={() => handleDeletePlayerSetting(s.id)}
                      className="flex-none px-2.5 py-1 rounded-lg text-[11px] font-bold border border-line text-ink-soft bg-paper"
                    >
                      削除
                    </button>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
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
        {candidates.length > 0 && (
          <div className={playerSettings.length > 0 ? "mt-2.5 flex gap-2" : "flex gap-2"}>
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
              className="flex-none px-3.5 rounded-lg font-bold text-[12.5px] border border-orange text-orange bg-orange/8 disabled:opacity-50"
            >
              追加
            </button>
          </div>
        )}
      </Card>

      <SectionLabel>{step("集金の設定")}</SectionLabel>
      <Card>
        <FieldLabel>集金の周期</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {DUES_CYCLE_MONTHS_OPTIONS.map((c) => (
            <SegButton key={c} active={item.cycle_months === c} onClick={() => handleSave({ cycle_months: c })}>
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
              <SegButton key={u} active={item.billing_unit === u} onClick={() => handleSave({ billing_unit: u })}>
                {DUES_BILLING_UNIT_LABELS[u]}
              </SegButton>
            ))}
          </div>
        </div>
      </Card>

      <SectionLabel>{step("会計への計上")}</SectionLabel>
      <Card>
        <FieldLabel>計上先の収入項目</FieldLabel>
        <select className={inputClass()} value={item.income_category_id} onChange={(e) => handleSave({ income_category_id: e.target.value })}>
          {incomeCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Card>

      <SectionLabel>{step("未納通知(任意)")}</SectionLabel>
      <Card>
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
              defaultValue={item.reminder_days_after ?? ""}
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
      </Card>

      <SectionLabel>削除</SectionLabel>
      <Card>
        <button
          type="button"
          onClick={handleDelete}
          className="w-full text-center py-2 rounded-lg font-bold text-[12.5px] border bg-white"
          style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
        >
          {deleteConfirm ? "もう一度タップで削除確定" : "この集金項目を削除"}
        </button>
      </Card>
    </PageShell>
  );
}
