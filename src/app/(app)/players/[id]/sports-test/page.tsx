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

export default function SportsTestPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { role, userId } = useSession();
  const toast = useToast();

  const [player, setPlayer] = useState<Player | null>(null);
  const [fiscalYear, setFiscalYear] = useState(CURRENT_FISCAL_YEAR);
  const [quarter, setQuarter] = useState<number>(1);
  const [record, setRecord] = useState<SportsTestRecord | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!canManageSportsTests(role)) router.replace("/players");
  }, [role, router]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("players").select("*").eq("id", params.id).single();
      setPlayer(data ?? null);
    })();
  }, [params.id]);

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
    setLoading(false);
  }, [params.id, fiscalYear, quarter]);

  useEffect(() => {
    load();
  }, [load]);

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
          wingspan_cm: numOrNull(form.wingspan_cm),
          sprint20m_1: numOrNull(form.sprint20m_1),
          sprint20m_2: numOrNull(form.sprint20m_2),
          long_jump_1: numOrNull(form.long_jump_1),
          long_jump_2: numOrNull(form.long_jump_2),
          lane_agility_1: numOrNull(form.lane_agility_1),
          lane_agility_2: numOrNull(form.lane_agility_2),
          side_step_1: numOrNull(form.side_step_1),
          side_step_2: numOrNull(form.side_step_2),
          shuttle_20m_x3: numOrNull(form.shuttle_20m_x3),
          ball_throw_1: numOrNull(form.ball_throw_1),
          ball_throw_2: numOrNull(form.ball_throw_2),
          back_fist_right: numOrNull(form.back_fist_right),
          back_fist_left: numOrNull(form.back_fist_left),
          ft_golf: numOrNull(form.ft_golf),
          beep_test_reps: numOrNull(form.beep_test_reps),
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
    toast("スポーツテスト記録を保存しました");
  }

  return (
    <PageShell
      header={
        <AppHeader
          title={player ? `${playerFullName(player)} / スポーツテスト` : "スポーツテスト"}
          variant="detail"
          backHref={`/players/${params.id}`}
          accessBadge="coach"
        />
      }
    >
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
      </Card>

      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : (
        <>
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
          </Card>

          <SectionLabel>スプリント・敏捷性</SectionLabel>
          <Card>
            <FieldLabel>20mスプリント(秒・2回)</FieldLabel>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                min={0}
                className={inputClass()}
                placeholder="1回目"
                value={form.sprint20m_1}
                onChange={(e) => setField("sprint20m_1", e.target.value)}
              />
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
            <div className="mt-3">
              <FieldLabel>レーンアジリティ(秒・2回)</FieldLabel>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  className={inputClass()}
                  placeholder="1回目"
                  value={form.lane_agility_1}
                  onChange={(e) => setField("lane_agility_1", e.target.value)}
                />
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
            <div className="mt-3">
              <FieldLabel>反復横跳び(点・2回)</FieldLabel>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  className={inputClass()}
                  placeholder="1回目"
                  value={form.side_step_1}
                  onChange={(e) => setField("side_step_1", e.target.value)}
                />
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
            </div>
          </Card>

          <SectionLabel>跳躍・投球</SectionLabel>
          <Card>
            <FieldLabel>立ち幅跳び(cm・2回)</FieldLabel>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                className={inputClass()}
                placeholder="1回目"
                value={form.long_jump_1}
                onChange={(e) => setField("long_jump_1", e.target.value)}
              />
              <input
                type="number"
                min={0}
                className={inputClass()}
                placeholder="2回目"
                value={form.long_jump_2}
                onChange={(e) => setField("long_jump_2", e.target.value)}
              />
            </div>
            <div className="mt-3">
              <FieldLabel>ボール投げ(m・2回)</FieldLabel>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  className={inputClass()}
                  placeholder="1回目"
                  value={form.ball_throw_1}
                  onChange={(e) => setField("ball_throw_1", e.target.value)}
                />
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
          </Card>

          <SectionLabel>柔軟性</SectionLabel>
          <Card>
            <FieldLabel>背中こぶし合わせ(cm)</FieldLabel>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.1"
                className={inputClass()}
                placeholder="右上"
                value={form.back_fist_right}
                onChange={(e) => setField("back_fist_right", e.target.value)}
              />
              <input
                type="number"
                step="0.1"
                className={inputClass()}
                placeholder="左上"
                value={form.back_fist_left}
                onChange={(e) => setField("back_fist_left", e.target.value)}
              />
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
            <div className="mt-3">
              <FieldLabel>20mシャトルラン(回)</FieldLabel>
              <input
                type="number"
                min={0}
                className={inputClass()}
                value={form.beep_test_reps}
                onChange={(e) => setField("beep_test_reps", e.target.value)}
              />
            </div>
          </Card>

          <SubmitButton onClick={handleSave} disabled={saving}>
            {saving ? "保存中…" : record ? "更新する" : "保存する"}
          </SubmitButton>
        </>
      )}
    </PageShell>
  );
}
