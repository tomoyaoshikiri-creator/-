"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { EmptyState, SectionLabel, cardClass } from "@/components/ui/Card";
import { Fab, Modal } from "@/components/ui/Modal";
import { FieldLabel, SegButton, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { ChevronRightIcon } from "@/components/icons";
import { FISCAL_MONTHS, sortedCollectionMonths } from "@/lib/duesAnnualSchedule";
import { calculateDuesInstallments } from "@/lib/duesRatePlan";
import { MIN_GRADE_BY_CATEGORY, GRADUATION_GRADE_BY_CATEGORY } from "@/lib/category";
import { gradeLabel, playerFullName, sortPlayers } from "@/lib/format";
import { canManageAccounting } from "@/lib/permissions";
import { hasAccountingAccess } from "@/lib/plan";
import {
  DUES_BILLING_UNIT_LABELS,
  DUES_CYCLE_MONTHS_LABELS,
  DUES_CYCLE_MONTHS_OPTIONS,
  DUES_PRICING_METHOD_LABELS,
  DUES_PAYMENT_METHOD_OPTIONS,
  DUES_PAYMENT_METHOD_LABELS,
  formatYen,
  type DuesPaymentMethod,
  type DuesBillingUnit,
  type DuesCycleMonths,
  type DuesPricingMethod,
} from "@/lib/accounting";
import type { AccountingCategory, AccountingDuesItem, RosterPlayer, TeamCategory } from "@/lib/database.types";

interface Draft {
  name: string;
  pricing_method: DuesPricingMethod;
  flat_monthly_amount: string;
  cycle_months: DuesCycleMonths;
  billing_unit: DuesBillingUnit;
  income_category_id: string;
  rate_basis: "monthly" | "yearly";
  flat_yearly_amount: string;
  collection_months: number[];
  join_leave_rule: "prorated" | "full";
  payment_methods: DuesPaymentMethod[];
  reminder_days_after: string;
}

function emptyDraft(): Draft {
  return { name: "", pricing_method: "flat", flat_monthly_amount: "", cycle_months: 1, billing_unit: "player", income_category_id: "",
    rate_basis: "monthly", flat_yearly_amount: "", collection_months: [4,7,10,1], join_leave_rule: "prorated", payment_methods: [], reminder_days_after: "" };
}

type NewBand = { grade_min: number; grade_max: number; monthly_amount: string; yearly_amount: string };
type NewPlayerSetting = { player_id: string; monthly_amount: string; exempt: boolean; start_date: string; stop_date: string; note: string };
function gradesFor(category: TeamCategory): number[] {
  const min = MIN_GRADE_BY_CATEGORY[category], max = GRADUATION_GRADE_BY_CATEGORY[category];
  if (min === null || max === null) return [];
  return [...(category === "小学生" ? [0] : []), ...Array.from({ length: max-min+1 }, (_,i) => min+i)];
}
export default function AccountingDuesPage() {
  const router = useRouter();
  const { role, plan, teamId, category } = useSession();
  const toast = useToast();

  useEffect(() => {
    if (!canManageAccounting(role) || !hasAccountingAccess(plan)) router.replace("/accounting");
  }, [role, plan, router]);

  const [items, setItems] = useState<AccountingDuesItem[]>([]);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [bands, setBands] = useState<NewBand[]>([]);
  const [bandInput, setBandInput] = useState<NewBand>({ grade_min: 0, grade_max: 0, monthly_amount: "", yearly_amount: "" });
  const [playerSettings, setPlayerSettings] = useState<NewPlayerSetting[]>([]);
  const [newPlayerId, setNewPlayerId] = useState("");
  const [incomeCategories, setIncomeCategories] = useState<AccountingCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: duesItems }, { data: cats }, { data: players }] = await Promise.all([
      supabase.from("accounting_dues_items").select("*").order("position", { ascending: true }),
      supabase.from("accounting_categories").select("*").eq("kind", "income").eq("auto_managed", false).order("position", { ascending: true }),
      supabase.rpc("list_roster_players"),
    ]);
    setItems(duesItems ?? []);
    setRoster(sortPlayers(players ?? []));
    setIncomeCategories(cats ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);

  function openModal() {
    setDraft({ ...emptyDraft(), income_category_id: incomeCategories[0]?.id ?? "" });
    setBands([]);
    setBandInput({ grade_min: gradesFor(category)[0] ?? 0, grade_max: gradesFor(category)[0] ?? 0, monthly_amount: "", yearly_amount: "" });
    setPlayerSettings([]);
    setNewPlayerId("");
    setModalOpen(true);
  }

  async function handleCreate() {
    if (saving) return;
    const amount = Number(draft.rate_basis === "yearly" ? draft.flat_yearly_amount : draft.flat_monthly_amount);
    if (!draft.name.trim() || !draft.income_category_id) { toast.warning("名称・計上先の項目を入力してください"); return; }
    if (!draft.collection_months.length) { toast.warning("集金月を選択してください"); return; }
    if (draft.pricing_method === "flat" && (!Number.isSafeInteger(amount) || amount <= 0)) {
      toast.warning("料金を正しく入力してください"); return;
    }
    if (draft.pricing_method === "grade_band") {
      if (bands.length === 0) {
        toast.warning("学年帯を1件以上設定してください"); return;
      }
      if (bands.some(b => !Number.isSafeInteger(Number(draft.rate_basis === "yearly" ? b.yearly_amount : b.monthly_amount)) || Number(draft.rate_basis === "yearly" ? b.yearly_amount : b.monthly_amount) <= 0 ||
        b.grade_min > b.grade_max)) { toast.warning("学年帯の料金・範囲を確認してください"); return; }
      const occupied = new Set<number>();
      for (const band of bands) for (let g=band.grade_min;g<=band.grade_max;g++) {
        if (occupied.has(g)) { toast.warning("学年帯が重複しています"); return; }
        occupied.add(g);
      }
    }
    if (draft.pricing_method === "per_player" && playerSettings.length === 0) {
      toast.warning("選手別料金を1件以上設定してください"); return;
    }
    if (playerSettings.some(p => !p.exempt && p.monthly_amount !== "" &&
      (!Number.isSafeInteger(Number(p.monthly_amount)) || Number(p.monthly_amount) < 0))) {
      toast.warning("選手別料金を確認してください"); return;
    }
    if (draft.pricing_method === "per_player" && playerSettings.some(p => !p.exempt && p.monthly_amount === "")) {
      toast.warning("選手ごとの月額を入力してください"); return;
    }
    if (draft.reminder_days_after !== "" && (!Number.isSafeInteger(Number(draft.reminder_days_after)) || Number(draft.reminder_days_after) < 0)) {
      toast.warning("リマインド日数を確認してください"); return;
    }
    setSaving(true);
    const supabase = createClient();
    const nextPosition = items.length > 0 ? Math.max(...items.map(i => i.position)) + 1 : 0;
    const { data, error } = await supabase.from("accounting_dues_items").insert({
      team_id: teamId, name: draft.name.trim(), pricing_method: draft.pricing_method,
      flat_monthly_amount: draft.pricing_method === "flat" && draft.rate_basis === "monthly" ? amount : null,
      flat_yearly_amount: draft.pricing_method === "flat" && draft.rate_basis === "yearly" ? amount : null,
      schedule_mode: "configured", rate_basis: draft.rate_basis,
      collection_months: sortedCollectionMonths(draft.collection_months), join_leave_rule: draft.join_leave_rule,
      payment_methods: draft.payment_methods, reminder_days_after: draft.reminder_days_after === "" ? null : Number(draft.reminder_days_after),
      cycle_months: draft.cycle_months, billing_unit: draft.billing_unit,
      income_category_id: draft.income_category_id, position: nextPosition,
    }).select("*").single();
    if (error || !data) { setSaving(false); toast.error(`作成に失敗しました: ${error?.message ?? ""}`); return; }
    // 関連テーブルの作成に失敗した場合は項目本体も削除して不完全な作成を残さない。
    const bandRows = bands.map(b => ({ dues_item_id: data.id, grade_min: b.grade_min, grade_max: b.grade_max, monthly_amount: draft.rate_basis === "monthly" ? Number(b.monthly_amount) : 0, yearly_amount: draft.rate_basis === "yearly" ? Number(b.yearly_amount) : null }));
    const playerRows = playerSettings.map(p => ({ dues_item_id: data.id, player_id: p.player_id,
      monthly_amount: p.monthly_amount === "" ? null : Number(p.monthly_amount),
      exempt: p.exempt, start_date: p.start_date || null, stop_date: p.stop_date || null, note: p.note.trim() || null }));
    const bandError = bandRows.length ? (await supabase.from("accounting_dues_grade_bands").insert(bandRows)).error : null;
    const playerError = !bandError && playerRows.length ? (await supabase.from("accounting_dues_player_settings").insert(playerRows)).error : null;
    if (bandError || playerError) {
      const { error: rollbackError } = await supabase.from("accounting_dues_items").delete().eq("id", data.id);
      setSaving(false);
      toast.error(rollbackError ? "関連設定の保存に失敗しました。作成された項目を確認してください" : "関連設定の保存に失敗したため、作成を取り消しました");
      return;
    }
    setSaving(false);
    setModalOpen(false);
    setItems(prev => [...prev, data]);
    toast.success("集金項目を追加しました");
    router.push(`/accounting/dues/${data.id}`);
  }

  return (
    <PageShell
      header={<AppHeader title="集金" variant="list" backHref="/accounting" accessBadge="operations" />}
      fab={
        <>
          <Fab onClick={openModal} label="追加" />
          <Modal open={modalOpen} onClose={() => !saving && setModalOpen(false)} title="集金項目を追加">
            <div className="space-y-4">
              <section>
                <FieldLabel>1. 名称</FieldLabel>
                <input className={inputClass()} value={draft.name}
                  onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="例：部費" />
              </section>
              <section>
                <FieldLabel>2. 料金の決め方</FieldLabel>
                <div className="flex flex-col gap-1.5">
                  {(Object.keys(DUES_PRICING_METHOD_LABELS) as DuesPricingMethod[]).map(m => (
                    <SegButton key={m} active={draft.pricing_method === m} onClick={() => setDraft(d => ({ ...d, pricing_method: m, rate_basis: m === "per_player" ? "monthly" : d.rate_basis }))}>
                      {DUES_PRICING_METHOD_LABELS[m]}
                    </SegButton>
                  ))}
                </div>
              </section>
              <section>
                <FieldLabel>3. 料金の基準</FieldLabel>
                <div className="text-[11px] text-ink-soft mb-2">月額または年額を選択してください。</div>
                <div className="flex gap-2 mb-2">
                  {(draft.pricing_method === "per_player" ? ["monthly"] as const : ["monthly","yearly"] as const).map(basis=><SegButton key={basis} active={draft.rate_basis===basis}
                    onClick={()=>setDraft(d=>({...d,rate_basis:basis}))}>{basis==="monthly"?"月額":"年額"}</SegButton>)}
                </div>
              </section>
              {draft.pricing_method === "grade_band" && <section>
                <FieldLabel>4. 学年帯ごとの料金</FieldLabel>
                <div className="text-[11px] text-ink-soft mb-2">上で選択した料金基準に応じて金額を設定します。</div>
                {bands.map((b,i) => <div key={i} className="flex items-center justify-between gap-2 border-b border-line py-2 text-[12px]">
                  <span>{gradeLabel(String(b.grade_min),category)}〜{gradeLabel(String(b.grade_max),category)}：{formatYen(Number(draft.rate_basis === "yearly" ? b.yearly_amount : b.monthly_amount))}/{draft.rate_basis === "yearly" ? "年" : "月"}</span>
                  <button type="button" className="text-ink-soft underline" onClick={() => setBands(prev => prev.filter((_,j) => j!==i))}>削除</button>
                </div>)}
                <div className="flex gap-1.5 mt-2">
                  <select className={inputClass("flex-1 min-w-0")} value={bandInput.grade_min} onChange={e=>setBandInput(d=>({...d,grade_min:Number(e.target.value)}))}>
                    {gradesFor(category).map(g=><option key={g} value={g}>{gradeLabel(String(g),category)}</option>)}
                  </select>
                  <span>〜</span>
                  <select className={inputClass("flex-1 min-w-0")} value={bandInput.grade_max} onChange={e=>setBandInput(d=>({...d,grade_max:Number(e.target.value)}))}>
                    {gradesFor(category).map(g=><option key={g} value={g}>{gradeLabel(String(g),category)}</option>)}
                  </select>
                </div>
                <div className="flex gap-2 mt-2">
                  <input type="number" min={1} className={inputClass("flex-1")} placeholder={draft.rate_basis === "yearly" ? "年額" : "月額"} value={draft.rate_basis === "yearly" ? bandInput.yearly_amount : bandInput.monthly_amount}
                    onChange={e=>setBandInput(d=>({...d,[draft.rate_basis === "yearly" ? "yearly_amount" : "monthly_amount"]:e.target.value}))} />
                  <button type="button" className="px-3 rounded-lg border border-line font-bold text-[12px]"
                    onClick={()=>{
                      const n=Number(draft.rate_basis === "yearly" ? bandInput.yearly_amount : bandInput.monthly_amount);
                      if (bandInput.grade_min>bandInput.grade_max || !Number.isSafeInteger(n) || n<=0) { toast.warning("学年帯と料金を確認してください"); return; }
                      setBands(prev=>[...prev,bandInput].sort((x,y)=>x.grade_min-y.grade_min));
                      setBandInput({grade_min:gradesFor(category)[0]??0,grade_max:gradesFor(category)[0]??0,monthly_amount:"",yearly_amount:""});
                    }}>追加</button>
                </div>
              </section>}
              <section>
                <FieldLabel>{draft.pricing_method === "grade_band" ? "5." : "4."} 集金月・集金予定額</FieldLabel>

                {draft.pricing_method==="flat" && <input type="number" min={1} placeholder={draft.rate_basis==="monthly"?"月額（円）":"年額（円）"}
                  className={inputClass()} value={draft.rate_basis==="monthly"?draft.flat_monthly_amount:draft.flat_yearly_amount}
                  onChange={e=>setDraft(d=>({...d,[d.rate_basis==="monthly"?"flat_monthly_amount":"flat_yearly_amount"]:e.target.value}))}/>}
                <div className="grid grid-cols-4 gap-1.5 mt-2">
                  {FISCAL_MONTHS.map(month=><SegButton key={month} active={draft.collection_months.includes(month)}
                    onClick={()=>setDraft(d=>({...d,collection_months:d.collection_months.includes(month)?d.collection_months.filter(m=>m!==month):sortedCollectionMonths([...d.collection_months,month])}))}>{month}月</SegButton>)}
                </div>
                <div className="mt-2">
                  <FieldLabel>途中加入・退団</FieldLabel>
                  <div className="flex gap-2">
                    {([["prorated","在籍月数分"],["full","対象期間の全額"]] as const).map(([rule,label])=><SegButton key={rule} active={draft.join_leave_rule===rule}
                      onClick={()=>setDraft(d=>({...d,join_leave_rule:rule}))}>{label}</SegButton>)}
                  </div>
                </div>
                {draft.collection_months.length>0 && (draft.pricing_method==="flat" || draft.pricing_method==="grade_band") && <div className="mt-2 bg-line/30 rounded-lg p-2.5 text-[12px]">
                  <div className="font-bold mb-1">集金予定額（試算）</div>
                  {(draft.pricing_method==="flat" ? [{label:"一律",amount:Number(draft.rate_basis==="yearly"?draft.flat_yearly_amount:draft.flat_monthly_amount)}] :
                    bands.map(b=>({label:`${gradeLabel(String(b.grade_min),category)}〜${gradeLabel(String(b.grade_max),category)}`,amount:Number(draft.rate_basis === "yearly" ? b.yearly_amount : b.monthly_amount)})))
                    .map((plan,i)=>{
                      let rows:ReturnType<typeof calculateDuesInstallments>=[];
                      try {rows=calculateDuesInstallments({basis:draft.rate_basis,amount:plan.amount,collectionMonths:draft.collection_months});} catch {}
                      return <div key={i} className="mb-2">
                        <div className="font-bold">{plan.label}</div>
                        {rows.map(row=><div key={row.month} className="flex justify-between"><span>{row.month}月（{row.coveredMonths.length}か月分）</span><span>{formatYen(row.amount)}</span></div>)}
                      </div>;
                    })}
                </div>}
              </section>
              <section>
                <FieldLabel>{draft.pricing_method === "grade_band" ? "6." : "5."} 選手ごとの個別設定</FieldLabel>
                <div className="text-[11px] text-ink-soft mb-2">免除・金額の上書き・請求開始/停止月が必要な選手を設定します。</div>
                {playerSettings.map(p=><div key={p.player_id} className="border border-line rounded-lg p-2.5 mb-2 space-y-2">
                  <div className="flex items-center justify-between text-[12px] font-bold">
                    <span>{playerFullName(roster.find(x=>x.id===p.player_id)!)}</span>
                    <button type="button" className="text-ink-soft underline" onClick={()=>setPlayerSettings(prev=>prev.filter(x=>x.player_id!==p.player_id))}>削除</button>
                  </div>
                  <div className="flex gap-2 items-center">
                    <input type="number" min={0} placeholder="月額（空欄は基本料金）" className={inputClass("flex-1")} value={p.monthly_amount}
                      onChange={e=>setPlayerSettings(prev=>prev.map(x=>x.player_id===p.player_id?{...x,monthly_amount:e.target.value}:x))}/>
                    <label className="flex gap-1 text-[12px]"><input type="checkbox" checked={p.exempt}
                      onChange={e=>setPlayerSettings(prev=>prev.map(x=>x.player_id===p.player_id?{...x,exempt:e.target.checked}:x))}/>免除</label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[11px]">開始日<input type="date" className={inputClass()} value={p.start_date} onChange={e=>setPlayerSettings(prev=>prev.map(x=>x.player_id===p.player_id?{...x,start_date:e.target.value}:x))}/></label>
                    <label className="text-[11px]">停止日<input type="date" className={inputClass()} value={p.stop_date} onChange={e=>setPlayerSettings(prev=>prev.map(x=>x.player_id===p.player_id?{...x,stop_date:e.target.value}:x))}/></label>
                  </div>
                  <input className={inputClass()} placeholder="備考" value={p.note} onChange={e=>setPlayerSettings(prev=>prev.map(x=>x.player_id===p.player_id?{...x,note:e.target.value}:x))}/>
                </div>)}
                <div className="flex gap-2">
                  <select className={inputClass("flex-1")} value={newPlayerId} onChange={e=>setNewPlayerId(e.target.value)}>
                    <option value="">選手を選ぶ</option>
                    {roster.filter(p=>!playerSettings.some(x=>x.player_id===p.id)).map(p=><option key={p.id} value={p.id}>{playerFullName(p)}</option>)}
                  </select>
                  <button type="button" className="px-3 border border-line rounded-lg font-bold text-[12px]" disabled={!newPlayerId}
                    onClick={()=>{setPlayerSettings(prev=>[...prev,{player_id:newPlayerId,monthly_amount:"",exempt:false,start_date:"",stop_date:"",note:""}]);setNewPlayerId("");}}>追加</button>
                </div>
              </section>
              <section>
                <FieldLabel>{draft.pricing_method === "grade_band" ? "7." : "6."} 集金の設定</FieldLabel>
                <div className="text-[11px] text-ink-soft">集金の周期は上の「集金月」で設定します。</div>
                <FieldLabel>請求の単位</FieldLabel>
                <div className="flex gap-2">{(Object.keys(DUES_BILLING_UNIT_LABELS) as DuesBillingUnit[]).map(u=><SegButton key={u} active={draft.billing_unit===u}
                  onClick={()=>setDraft(d=>({...d,billing_unit:u}))}>{DUES_BILLING_UNIT_LABELS[u]}</SegButton>)}</div>
                <FieldLabel>支払方法</FieldLabel>
                <div className="flex flex-wrap gap-1.5">{DUES_PAYMENT_METHOD_OPTIONS.map(method=><SegButton key={method} active={draft.payment_methods.includes(method)}
                  onClick={()=>setDraft(d=>({...d,payment_methods:d.payment_methods.includes(method)?d.payment_methods.filter(m=>m!==method):[...d.payment_methods,method]}))}>{DUES_PAYMENT_METHOD_LABELS[method]}</SegButton>)}</div>
              </section>
              <section>
                <FieldLabel>{draft.pricing_method === "grade_band" ? "8." : "7."} 計上先の収入項目</FieldLabel>
                <select className={inputClass()} value={draft.income_category_id} onChange={e=>setDraft(d=>({...d,income_category_id:e.target.value}))}>
                  <option value="">選ぶ</option>
                  {incomeCategories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {incomeCategories.length===0 && <div className="text-[11px] text-danger-text mt-1">先に「項目の管理」で収入項目を追加してください</div>}
              </section>
              <section>
                <FieldLabel>{draft.pricing_method === "grade_band" ? "9." : "8."} リマインド設定（日数・任意）</FieldLabel>
                <input type="number" min={0} className={inputClass()} value={draft.reminder_days_after}
                  onChange={e=>setDraft(d=>({...d,reminder_days_after:e.target.value}))}/>
              </section>
              <SubmitButton onClick={handleCreate} disabled={saving || incomeCategories.length===0}>
                {saving?"保存中…":"この内容で追加する"}
              </SubmitButton>
            </div>
          </Modal>
        </>
      }
    >
      <div className="text-[12px] text-ink-soft mb-3">
        ここでは集金項目・料金・集金月を設定します。入金状況の確認と変更は「入金管理」から行えます。
      </div>
      <SectionLabel>集金項目の設定</SectionLabel>
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : items.length === 0 ? (
        <div className={cardClass}>
          <EmptyState>まだ集金項目がありません</EmptyState>
        </div>
      ) : (
        items.map((item) => (
          <div key={item.id} className="mb-2.5">
          <Link href={`/accounting/dues/${item.id}`}>
            <div className={`${cardClass} cursor-pointer`}>
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-bold text-[15px] flex items-center gap-1.5">
                    {item.name}
                    {!item.active && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-line text-ink-soft flex-shrink-0">停止中</span>
                    )}
                  </div>
                  <div className="text-[11.5px] text-ink-soft mt-1">
                    {DUES_PRICING_METHOD_LABELS[item.pricing_method as DuesPricingMethod]} ・{" "}
                    {DUES_CYCLE_MONTHS_LABELS[item.cycle_months as DuesCycleMonths]}
                  </div>
                </div>
                <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
              </div>
            </div>
          </Link>
          </div>
        ))
      )}
    </PageShell>
  );
}
