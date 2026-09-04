"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { FieldLabel, SegButton, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { canManageSportsTests } from "@/lib/permissions";
import { hasSportsTestAccess } from "@/lib/plan";
import { useUnsavedChangesGuard } from "@/lib/navigationGuard";
import { SPORTS_TEST_RANKING_METRICS } from "@/lib/karteAggregate";
import { fiscalYearOf, playerFullName, todayDateStr } from "@/lib/format";
import type { Player, SportsTestRecord } from "@/lib/database.types";

const CURRENT_FISCAL_YEAR = fiscalYearOf(todayDateStr());
const FISCAL_YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_FISCAL_YEAR - 4 + i);
const QUARTERS = [1, 2, 3, 4] as const;

interface FormState {
  wingspan_cm: string;
  sprint20m_1: string;
  sprint20m_2: string;
  long_jump_1: string;
  long_jump_2: string;
  lane_agility_1: string;
  lane_agility_2: string;
  side_step_1: string;
  side_step_2: string;
  shuttle_20m_x3: string;
  ball_throw_1: string;
  ball_throw_2: string;
  back_fist_right: string;
  back_fist_left: string;
  ft_golf: string;
  beep_test_reps: string;
}

const EMPTY_FORM: FormState = {
  wingspan_cm: "",
  sprint20m_1: "",
  sprint20m_2: "",
  long_jump_1: "",
  long_jump_2: "",
  lane_agility_1: "",
  lane_agility_2: "",
  side_step_1: "",
  side_step_2: "",
  shuttle_20m_x3: "",
  ball_throw_1: "",
  ball_throw_2: "",
  back_fist_right: "",
  back_fist_left: "",
  ft_golf: "",
  beep_test_reps: "",
};

function recordToForm(r: SportsTestRecord | null): FormState {
  if (!r) return EMPTY_FORM;
  const toStr = (v: number | null) => (v === null ? "" : String(v));
  return {
    wingspan_cm: toStr(r.wingspan_cm),
    sprint20m_1: toStr(r.sprint20m_1),
    sprint20m_2: toStr(r.sprint20m_2),
    long_jump_1: toStr(r.long_jump_1),
    long_jump_2: toStr(r.long_jump_2),
    lane_agility_1: toStr(r.lane_agility_1),
    lane_agility_2: toStr(r.lane_agility_2),
    side_step_1: toStr(r.side_step_1),
    side_step_2: toStr(r.side_step_2),
    shuttle_20m_x3: toStr(r.shuttle_20m_x3),
    ball_throw_1: toStr(r.ball_throw_1),
    ball_throw_2: toStr(r.ball_throw_2),
    back_fist_right: toStr(r.back_fist_right),
    back_fist_left: toStr(r.back_fist_left),
    ft_golf: toStr(r.ft_golf),
    beep_test_reps: toStr(r.beep_test_reps),
  };
}

function numOrNull(v: string): number | null {
  const trimmed = v.trim();
  return trimmed === "" ? null : Number(trimmed);
}

function fmtNum(n: number): string {
  const r = Math.round(n * 100) / 100;
  return String(r);
}

function fmtDiff(diff: number): string {
  const r = Math.round(diff * 100) / 100;
  if (r === 0) return "±0";
  return r > 0 ? `+${fmtNum(r)}` : fmtNum(r);
}

function CompareLine({
  current,
  baseline,
  baselineQuarter,
}: {
  current: number | null;
  baseline: number | null;
  baselineQuarter?: number;
}) {
  if (baseline === null || current === null) return null;
  return (
    <div className="text-[10.5px] text-heading font-bold mt-1">
      {baselineQuarter ? `Q${baselineQuarter}: ` : ""}
      {fmtNum(baseline)} → {fmtNum(current)} ({fmtDiff(current - baseline)})
    </div>
  );
}

// ①②の2回計測がある項目は、それぞれの回ごとではなく、より良い方の記録同士で比較する
// (試技によるブレを避け、その時点のベスト記録の伸びを見たいため)。
function bestOf(a: number | null, b: number | null, direction: "asc" | "desc"): number | null {
  const vals = [a, b].filter((v): v is number => v !== null);
  if (vals.length === 0) return null;
  return direction === "asc" ? Math.min(...vals) : Math.max(...vals);
}

export default function SportsTestPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { role, userId, plan } = useSession();
  const toast = useToast();

  const [player, setPlayer] = useState<Player | null>(null);
  const [fiscalYear, setFiscalYear] = useState(CURRENT_FISCAL_YEAR);
  const [quarter, setQuarter] = useState<number>(1);
  const [record, setRecord] = useState<SportsTestRecord | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [notConducted, setNotConducted] = useState(false);
  const [baseline, setBaseline] = useState<SportsTestRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [viewMode, setViewMode] = useState<"input" | "table">("input");
  const [yearRecords, setYearRecords] = useState<SportsTestRecord[]>([]);

  const savedForm = recordToForm(record);
  const isDirty =
    JSON.stringify(form) !== JSON.stringify(savedForm) || notConducted !== (record?.not_conducted ?? false);
  useUnsavedChangesGuard(!loading && isDirty);

  useEffect(() => {
    if (!hasSportsTestAccess(plan)) {
      setAuthorized(false);
      router.replace("/players");
      return;
    }
    (async () => {
      if (canManageSportsTests(role)) {
        setAuthorized(true);
        return;
      }
      const supabase = createClient();
      const { data: link } = await supabase
        .from("player_guardians")
        .select("id")
        .eq("player_id", params.id)
        .eq("profile_id", userId)
        .maybeSingle();
      if (link) {
        setAuthorized(true);
      } else {
        setAuthorized(false);
        router.replace("/players");
      }
    })();
  }, [role, userId, params.id, plan, router]);

  useEffect(() => {
    if (!authorized) return;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("players").select("*").eq("id", params.id).single();
      setPlayer(data ?? null);
    })();
  }, [params.id, authorized]);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("sports_test_records")
      .select("*")
      .eq("player_id", params.id)
      .eq("fiscal_year", fiscalYear)
      .eq("quarter", quarter)
      .maybeSingle();
    setRecord(data ?? null);
    setForm(recordToForm(data ?? null));
    setNotConducted(data?.not_conducted ?? false);

    if (quarter > 1) {
      const { data: baseRows } = await supabase
        .from("sports_test_records")
        .select("*")
        .eq("player_id", params.id)
        .eq("fiscal_year", fiscalYear)
        .eq("not_conducted", false)
        .lt("quarter", quarter)
        .order("quarter", { ascending: true })
        .limit(1);
      setBaseline(baseRows?.[0] ?? null);
    } else {
      setBaseline(null);
    }

    setLoading(false);
  }, [params.id, fiscalYear, quarter]);

  useEffect(() => {
    if (!authorized) return;
    load();
  }, [load, authorized]);

  // 「表で見る」表示用に、選択中の年度の四半期ごとの記録をまとめて取得しておく
  // (入力フォーム側は四半期を1つずつ切り替えて編集する作りのため別読み込みにしている)。
  const loadYearRecords = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("sports_test_records")
      .select("*")
      .eq("player_id", params.id)
      .eq("fiscal_year", fiscalYear);
    setYearRecords(data ?? []);
  }, [params.id, fiscalYear]);

  useEffect(() => {
    if (!authorized) return;
    loadYearRecords();
  }, [loadYearRecords, authorized]);

  function setField(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("sports_test_records")
      .upsert(
        {
          team_id: player!.team_id,
          player_id: params.id,
          fiscal_year: fiscalYear,
          quarter,
          not_conducted: notConducted,
          wingspan_cm: notConducted ? null : numOrNull(form.wingspan_cm),
          sprint20m_1: notConducted ? null : numOrNull(form.sprint20m_1),
          sprint20m_2: notConducted ? null : numOrNull(form.sprint20m_2),
          long_jump_1: notConducted ? null : numOrNull(form.long_jump_1),
          long_jump_2: notConducted ? null : numOrNull(form.long_jump_2),
          lane_agility_1: notConducted ? null : numOrNull(form.lane_agility_1),
          lane_agility_2: notConducted ? null : numOrNull(form.lane_agility_2),
          side_step_1: notConducted ? null : numOrNull(form.side_step_1),
          side_step_2: notConducted ? null : numOrNull(form.side_step_2),
          shuttle_20m_x3: notConducted ? null : numOrNull(form.shuttle_20m_x3),
          ball_throw_1: notConducted ? null : numOrNull(form.ball_throw_1),
          ball_throw_2: notConducted ? null : numOrNull(form.ball_throw_2),
          back_fist_right: notConducted ? null : numOrNull(form.back_fist_right),
          back_fist_left: notConducted ? null : numOrNull(form.back_fist_left),
          ft_golf: notConducted ? null : numOrNull(form.ft_golf),
          beep_test_reps: notConducted ? null : numOrNull(form.beep_test_reps),
          recorded_by: userId,
        },
        { onConflict: "player_id,fiscal_year,quarter" },
      )
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast(`保存に失敗しました: ${error.message}`);
      return;
    }
    setRecord(data);
    loadYearRecords();
    toast("スポーツテスト記録を保存しました");
  }

  if (!authorized) return null;

  return (
    <PageShell
      header={
        <AppHeader
          title={player ? `${playerFullName(player)} / スポーツテスト` : "スポーツテスト"}
          variant="detail"
          backHref={`/players/${params.id}`}
        />
      }
    >
      <div className="flex gap-1.5 mb-3">
        <SegButton active={viewMode === "input"} onClick={() => setViewMode("input")}>
          入力する
        </SegButton>
        <SegButton active={viewMode === "table"} onClick={() => setViewMode("table")}>
          表で見る
        </SegButton>
      </div>

      {viewMode === "table" ? (
        <>
          <SectionLabel>年度</SectionLabel>
          <Card>
            <FieldLabel>年度</FieldLabel>
            <select
              className={inputClass()}
              value={fiscalYear}
              onChange={(e) => setFiscalYear(Number(e.target.value))}
            >
              {FISCAL_YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}年度
                </option>
              ))}
            </select>
          </Card>

          <SectionLabel>四半期ごとの記録</SectionLabel>
          <div className="bg-white border border-line rounded-lg overflow-auto max-h-[65vh] mb-2.5">
            <table className="border-collapse text-[11.5px] w-full">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 h-11 bg-paper z-30 text-left px-2.5 border-b border-line whitespace-nowrap">
                    四半期
                  </th>
                  {SPORTS_TEST_RANKING_METRICS.map((m) => (
                    <th
                      key={m.value}
                      className="sticky top-0 h-11 bg-paper z-20 w-[54px] min-w-[54px] px-1 border-b border-line font-bold text-center leading-tight text-ink-soft"
                    >
                      <div className="whitespace-nowrap">{m.abbrLines[0]}</div>
                      <div className="whitespace-nowrap">{m.abbrLines[1]}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {QUARTERS.map((q) => {
                  const r = yearRecords.find((x) => x.quarter === q);
                  return (
                    <tr key={q}>
                      <td className="sticky left-0 bg-white z-10 px-2.5 py-2 whitespace-nowrap border-b border-line last:border-b-0 font-bold">
                        Q{q}
                      </td>
                      {SPORTS_TEST_RANKING_METRICS.map((m) => {
                        const v = r && !r.not_conducted ? m.extract(r) : null;
                        return (
                          <td
                            key={m.value}
                            className="w-[54px] min-w-[54px] px-1 py-2 text-center font-mono border-b border-line last:border-b-0"
                          >
                            {v === null ? "-" : v}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <SectionLabel>年度・四半期</SectionLabel>
          <Card>
            <FieldLabel>年度</FieldLabel>
            <select
              className={inputClass()}
              value={fiscalYear}
              onChange={(e) => setFiscalYear(Number(e.target.value))}
            >
              {FISCAL_YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}年度
                </option>
              ))}
            </select>
            <div className="mt-3">
              <FieldLabel>四半期</FieldLabel>
              <div className="flex gap-1.5">
                {QUARTERS.map((q) => (
                  <SegButton key={q} active={quarter === q} onClick={() => setQuarter(q)}>
                    Q{q}
                  </SegButton>
                ))}
              </div>
            </div>
            <div className="mt-3">
              <FieldLabel>実施状況</FieldLabel>
              <div className="flex gap-1.5">
                <SegButton active={!notConducted} onClick={() => setNotConducted(false)}>
                  実施
                </SegButton>
                <SegButton active={notConducted} onClick={() => setNotConducted(true)}>
                  未実施
                </SegButton>
              </div>
            </div>
            {baseline && (
              <div className="text-[11px] text-ink-soft mt-3">
                Q{baseline.quarter}(初回実績)との比較を各項目に表示しています
              </div>
            )}
          </Card>

          {loading ? (
            <EmptyState>読み込み中…</EmptyState>
          ) : (
            <>
              <div className={notConducted ? "opacity-40 pointer-events-none" : ""}>
          <SectionLabel>身体測定</SectionLabel>
          <Card>
            <FieldLabel>ウイングスパン(cm)</FieldLabel>
            <input
              type="number"
              step="0.1"
              min={0}
              className={inputClass()}
              value={form.wingspan_cm}
              onChange={(e) => setField("wingspan_cm", e.target.value)}
            />
            <CompareLine current={numOrNull(form.wingspan_cm)} baseline={baseline?.wingspan_cm ?? null} baselineQuarter={baseline?.quarter} />
          </Card>

          <SectionLabel>スプリント・敏捷性</SectionLabel>
          <Card>
            <FieldLabel>20mスプリント(秒・2回)</FieldLabel>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  className={inputClass()}
                  placeholder="1回目"
                  value={form.sprint20m_1}
                  onChange={(e) => setField("sprint20m_1", e.target.value)}
                />
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  className={inputClass()}
                  placeholder="2回目"
                  value={form.sprint20m_2}
                  onChange={(e) => setField("sprint20m_2", e.target.value)}
                />
              </div>
            </div>
            <div className="text-[10.5px] text-ink-soft mt-1">※小数点第2位まで</div>
            <CompareLine
              current={bestOf(numOrNull(form.sprint20m_1), numOrNull(form.sprint20m_2), "asc")}
              baseline={bestOf(baseline?.sprint20m_1 ?? null, baseline?.sprint20m_2 ?? null, "asc")}
              baselineQuarter={baseline?.quarter}
            />
            <div className="mt-3">
              <FieldLabel>レーンアジリティ(秒・2回)</FieldLabel>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    className={inputClass()}
                    placeholder="1回目"
                    value={form.lane_agility_1}
                    onChange={(e) => setField("lane_agility_1", e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    className={inputClass()}
                    placeholder="2回目"
                    value={form.lane_agility_2}
                    onChange={(e) => setField("lane_agility_2", e.target.value)}
                  />
                </div>
              </div>
              <div className="text-[10.5px] text-ink-soft mt-1">※小数点第2位まで</div>
              <CompareLine
                current={bestOf(numOrNull(form.lane_agility_1), numOrNull(form.lane_agility_2), "asc")}
                baseline={bestOf(baseline?.lane_agility_1 ?? null, baseline?.lane_agility_2 ?? null, "asc")}
                baselineQuarter={baseline?.quarter}
              />
            </div>
            <div className="mt-3">
              <FieldLabel>反復横跳び(点・2回)</FieldLabel>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="number"
                    min={0}
                    className={inputClass()}
                    placeholder="1回目"
                    value={form.side_step_1}
                    onChange={(e) => setField("side_step_1", e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <input
                    type="number"
                    min={0}
                    className={inputClass()}
                    placeholder="2回目"
                    value={form.side_step_2}
                    onChange={(e) => setField("side_step_2", e.target.value)}
                  />
                </div>
              </div>
              <CompareLine
                current={bestOf(numOrNull(form.side_step_1), numOrNull(form.side_step_2), "desc")}
                baseline={bestOf(baseline?.side_step_1 ?? null, baseline?.side_step_2 ?? null, "desc")}
                baselineQuarter={baseline?.quarter}
              />
            </div>
            <div className="mt-3">
              <FieldLabel>20m三往復(秒)</FieldLabel>
              <input
                type="number"
                step="0.01"
                min={0}
                className={inputClass()}
                value={form.shuttle_20m_x3}
                onChange={(e) => setField("shuttle_20m_x3", e.target.value)}
              />
              <div className="text-[10.5px] text-ink-soft mt-1">※小数点第2位まで</div>
              <CompareLine current={numOrNull(form.shuttle_20m_x3)} baseline={baseline?.shuttle_20m_x3 ?? null} baselineQuarter={baseline?.quarter} />
            </div>
          </Card>

          <SectionLabel>跳躍・投球</SectionLabel>
          <Card>
            <FieldLabel>立ち幅跳び(cm・2回)</FieldLabel>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  className={inputClass()}
                  placeholder="1回目"
                  value={form.long_jump_1}
                  onChange={(e) => setField("long_jump_1", e.target.value)}
                />
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  className={inputClass()}
                  placeholder="2回目"
                  value={form.long_jump_2}
                  onChange={(e) => setField("long_jump_2", e.target.value)}
                />
              </div>
            </div>
            <div className="text-[10.5px] text-ink-soft mt-1">※小数点第1位まで</div>
            <CompareLine
              current={bestOf(numOrNull(form.long_jump_1), numOrNull(form.long_jump_2), "desc")}
              baseline={bestOf(baseline?.long_jump_1 ?? null, baseline?.long_jump_2 ?? null, "desc")}
              baselineQuarter={baseline?.quarter}
            />
            <div className="mt-3">
              <FieldLabel>ボール投げ(m・2回)</FieldLabel>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    className={inputClass()}
                    placeholder="1回目"
                    value={form.ball_throw_1}
                    onChange={(e) => setField("ball_throw_1", e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    className={inputClass()}
                    placeholder="2回目"
                    value={form.ball_throw_2}
                    onChange={(e) => setField("ball_throw_2", e.target.value)}
                  />
                </div>
              </div>
              <div className="text-[10.5px] text-ink-soft mt-1">※小数点第1位まで</div>
              <CompareLine
                current={bestOf(numOrNull(form.ball_throw_1), numOrNull(form.ball_throw_2), "desc")}
                baseline={bestOf(baseline?.ball_throw_1 ?? null, baseline?.ball_throw_2 ?? null, "desc")}
                baselineQuarter={baseline?.quarter}
              />
            </div>
          </Card>

          <SectionLabel>柔軟性</SectionLabel>
          <Card>
            <FieldLabel>背中こぶし合わせ(cm)</FieldLabel>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="number"
                  step="0.1"
                  className={inputClass()}
                  placeholder="右上"
                  value={form.back_fist_right}
                  onChange={(e) => setField("back_fist_right", e.target.value)}
                />
                <CompareLine current={numOrNull(form.back_fist_right)} baseline={baseline?.back_fist_right ?? null} baselineQuarter={baseline?.quarter} />
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  step="0.1"
                  className={inputClass()}
                  placeholder="左上"
                  value={form.back_fist_left}
                  onChange={(e) => setField("back_fist_left", e.target.value)}
                />
                <CompareLine current={numOrNull(form.back_fist_left)} baseline={baseline?.back_fist_left ?? null} baselineQuarter={baseline?.quarter} />
              </div>
            </div>
          </Card>

          <SectionLabel>シュート・持久力(独自項目)</SectionLabel>
          <Card>
            <FieldLabel>FTゴルフ(10本中の成功数)</FieldLabel>
            <input
              type="number"
              min={0}
              max={10}
              className={inputClass()}
              value={form.ft_golf}
              onChange={(e) => setField("ft_golf", e.target.value)}
            />
            <CompareLine current={numOrNull(form.ft_golf)} baseline={baseline?.ft_golf ?? null} baselineQuarter={baseline?.quarter} />
            <div className="mt-3">
              <FieldLabel>20mシャトルラン(回)</FieldLabel>
              <input
                type="number"
                min={0}
                className={inputClass()}
                value={form.beep_test_reps}
                onChange={(e) => setField("beep_test_reps", e.target.value)}
              />
              <CompareLine current={numOrNull(form.beep_test_reps)} baseline={baseline?.beep_test_reps ?? null} baselineQuarter={baseline?.quarter} />
            </div>
          </Card>
          </div>

          <SubmitButton onClick={handleSave} disabled={saving}>
            {saving ? "保存中…" : record ? "更新する" : "保存する"}
          </SubmitButton>
            </>
          )}
        </>
      )}
    </PageShell>
  );
}
