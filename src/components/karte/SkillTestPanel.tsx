"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { Card, EmptyState } from "@/components/ui/Card";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { Pill } from "@/components/ui/Pill";
import { sendPushNotification } from "@/lib/pushNotify";
import { isSkillTestDanCrossing, skillTestLevelLabels } from "@/lib/skillTest";
import type { PlayerSkillTestProgress, SkillTest, SkillTestPromotionRequest } from "@/lib/database.types";

// カルテの選手個人ページ専用。検定(級・段制の技能検定)の作成・ランク申請をここで行う
// (選手一覧側の選手個人ページは閲覧専用)。指導者・管理者が申請しても即座には反映されず、
// 他の指導者・管理者が承認して初めてplayer_skill_test_progressへ反映される
// (skill_test_promotion_requests、誰でも承認可能なキュー方式)。
export function SkillTestPanel({ playerId }: { playerId: string }) {
  const { teamId, userId } = useSession();
  const toast = useToast();
  const [tests, setTests] = useState<SkillTest[]>([]);
  const [progress, setProgress] = useState<PlayerSkillTestProgress[]>([]);
  const [pendingRequests, setPendingRequests] = useState<SkillTestPromotionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<Record<string, string>>({});
  const [submittingTestId, setSubmittingTestId] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKyuCount, setNewKyuCount] = useState("10");
  const [newDanCount, setNewDanCount] = useState("5");
  const [addingTest, setAddingTest] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: t }, { data: p }, { data: r }] = await Promise.all([
      supabase.from("skill_tests").select("*").order("created_at", { ascending: true }),
      supabase
        .from("player_skill_test_progress")
        .select("*")
        .eq("player_id", playerId)
        .order("created_at", { ascending: false }),
      supabase
        .from("skill_test_promotion_requests")
        .select("*")
        .eq("player_id", playerId)
        .eq("status", "pending"),
    ]);
    setTests(t ?? []);
    setProgress(p ?? []);
    setPendingRequests(r ?? []);
    setLoading(false);
  }, [playerId]);

  useEffect(() => {
    load();
  }, [load]);

  function latestFor(testId: string) {
    return progress.find((row) => row.skill_test_id === testId) ?? null;
  }

  function pendingFor(testId: string) {
    return pendingRequests.find((row) => row.skill_test_id === testId) ?? null;
  }

  async function handleAddTest() {
    const name = newName.trim();
    const kyuCount = Number(newKyuCount);
    const danCount = Number(newDanCount);
    if (!name) {
      toast("検定名を入力してください");
      return;
    }
    if (!Number.isInteger(kyuCount) || !Number.isInteger(danCount) || kyuCount < 0 || danCount < 0 || kyuCount + danCount < 1) {
      toast("級・段の数を正しく入力してください");
      return;
    }
    setAddingTest(true);
    const supabase = createClient();
    const { error } = await supabase.from("skill_tests").insert({
      team_id: teamId,
      name,
      kyu_count: kyuCount,
      dan_count: danCount,
    });
    setAddingTest(false);
    if (error) {
      toast(`追加に失敗しました: ${error.message}`);
      return;
    }
    setNewName("");
    setNewKyuCount("10");
    setNewDanCount("5");
    setShowAddForm(false);
    load();
  }

  // ランクの申請。承認されるまでplayer_skill_test_progressには反映されない。
  async function handleRequestLevel(test: SkillTest) {
    const raw = selectedIndex[test.id];
    if (raw === undefined || raw === "") {
      toast("ランクを選択してください");
      return;
    }
    const targetIndex = Number(raw);
    const levels = skillTestLevelLabels(
      test.kyu_count,
      test.dan_count,
      test.level_names,
      test.dan_kyu_count,
      test.kyu_label,
      test.dan_label,
      test.chapters,
    );
    const label = levels[targetIndex];
    const isDan = isSkillTestDanCrossing(test.kyu_count, test.dan_kyu_count, targetIndex, test.chapters);
    setSubmittingTestId(test.id);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("skill_test_promotion_requests")
      .insert({
        team_id: teamId,
        player_id: playerId,
        skill_test_id: test.id,
        target_level_index: targetIndex,
        target_level_label: label,
        is_dan: isDan,
        requested_by: userId,
      })
      .select("*")
      .single();
    setSubmittingTestId(null);
    if (error || !data) {
      toast(`申請に失敗しました: ${error?.message ?? ""}`);
      return;
    }
    toast(`${test.name}の「${label}」を申請しました。承認をお待ちください`);
    sendPushNotification("skill_test_promotion_requested", data.id);
    setSelectedIndex((s) => ({ ...s, [test.id]: "" }));
    load();
  }

  if (loading) {
    return (
      <Card>
        <EmptyState>読み込み中…</EmptyState>
      </Card>
    );
  }

  return (
    <>
      {tests.length === 0 ? (
        <Card>
          <EmptyState>まだ検定がありません</EmptyState>
        </Card>
      ) : (
        tests.map((test) => {
          const current = latestFor(test.id);
          const pending = pendingFor(test.id);
          const levels = skillTestLevelLabels(
            test.kyu_count,
            test.dan_count,
            test.level_names,
            test.dan_kyu_count,
            test.kyu_label,
            test.dan_label,
            test.chapters,
          );
          return (
            <Card key={test.id} className="mb-2.5">
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-[13.5px]">{test.name}</div>
                <div className="text-[12px] text-ink-soft">現在: {current ? current.level_label : "未設定"}</div>
              </div>
              {pending ? (
                <Pill tone="pending">{pending.target_level_label}へ承認待ち</Pill>
              ) : (
                <div className="flex gap-2">
                  <select
                    className={inputClass("flex-1")}
                    value={selectedIndex[test.id] ?? ""}
                    onChange={(e) => setSelectedIndex((s) => ({ ...s, [test.id]: e.target.value }))}
                  >
                    <option value="">ランクを選択</option>
                    {levels.map((label, idx) => (
                      <option key={idx} value={idx}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleRequestLevel(test)}
                    disabled={submittingTestId === test.id}
                    className="flex-none px-3.5 py-2 rounded-lg font-bold text-[12px] border border-orange text-orange bg-orange/8"
                  >
                    {submittingTestId === test.id ? "申請中…" : "申請"}
                  </button>
                </div>
              )}
            </Card>
          );
        })
      )}

      {showAddForm ? (
        <Card>
          <FieldLabel>検定名</FieldLabel>
          <input className={inputClass()} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="例:ドリブル検定" />
          <div className="mt-3 flex gap-2">
            <div className="flex-1">
              <FieldLabel>級の数</FieldLabel>
              <input
                type="number"
                min={0}
                max={30}
                className={inputClass()}
                value={newKyuCount}
                onChange={(e) => setNewKyuCount(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <FieldLabel>段の数</FieldLabel>
              <input
                type="number"
                min={0}
                max={30}
                className={inputClass()}
                value={newDanCount}
                onChange={(e) => setNewDanCount(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <SubmitButton onClick={handleAddTest} disabled={addingTest} className="!mt-0 flex-1">
              {addingTest ? "追加中…" : "追加する"}
            </SubmitButton>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setNewName("");
              }}
              className="flex-1 text-center py-2.5 rounded-lg font-bold text-[13px] border border-line text-ink-soft bg-white"
            >
              キャンセル
            </button>
          </div>
        </Card>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="block w-full mb-2.5 text-center py-2 rounded-lg font-bold text-[12px] border border-line text-ink-soft bg-white"
        >
          + 検定を追加
        </button>
      )}
    </>
  );
}
