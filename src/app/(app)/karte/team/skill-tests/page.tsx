"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { InlineSelect } from "@/components/ui/InlineSelect";
import { Modal } from "@/components/ui/Modal";
import { Pill } from "@/components/ui/Pill";
import { canViewKarte } from "@/lib/permissions";
import { hasSkillTestAccess } from "@/lib/plan";
import { skillTestLevelLabels } from "@/lib/skillTest";
import { playerFullName, sortPlayers } from "@/lib/format";
import type { Player, PlayerSkillTestProgress, SkillTest, SkillTestPromotionRequest, TeamMember } from "@/lib/database.types";

export default function KarteTeamSkillTestsPage() {
  const router = useRouter();
  const { role, teamId, plan, userId } = useSession();
  const toast = useToast();
  const isStaff = canViewKarte(role);

  useEffect(() => {
    if (!hasSkillTestAccess(plan)) router.replace("/karte/team");
  }, [plan, router]);

  const [players, setPlayers] = useState<Player[]>([]);
  const [tests, setTests] = useState<SkillTest[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [progress, setProgress] = useState<PlayerSkillTestProgress[]>([]);
  const [requests, setRequests] = useState<SkillTestPromotionRequest[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPlayerId, setSavingPlayerId] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKyuCount, setNewKyuCount] = useState("10");
  const [newDanCount, setNewDanCount] = useState("5");
  const [addingTest, setAddingTest] = useState(false);

  // 申請モーダル(一般・運営専用): 選手を選んでランクと承認者を指定し、申請する。
  const [requestPlayer, setRequestPlayer] = useState<Player | null>(null);
  const [requestLevelIdx, setRequestLevelIdx] = useState("");
  const [requestApproverId, setRequestApproverId] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // 承認キュー(指導者・管理者向け): 却下時のみ理由コメントの入力を求める。
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [rejectingRequest, setRejectingRequest] = useState<SkillTestPromotionRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // レベル名編集(指導者・管理者向け): 級・段それぞれに任意の名前を設定できる。
  const [editingLevelNames, setEditingLevelNames] = useState(false);
  const [levelNameDrafts, setLevelNameDrafts] = useState<string[]>([]);
  const [savingLevelNames, setSavingLevelNames] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: p }, { data: t }, { data: links }, { data: members }] = await Promise.all([
      supabase.from("players").select("*"),
      supabase.from("skill_tests").select("*").order("created_at", { ascending: true }),
      // 一般・運営は自分に紐づく選手の分しか見られない(player_skill_test_progressの
      // RLSと同じ方針)。playersテーブル自体はRLS上チーム全員分が見えてしまうため、
      // 選手一覧はここでクライアント側から絞り込む。
      isStaff ? Promise.resolve({ data: null }) : supabase.from("player_guardians").select("player_id").eq("profile_id", userId),
      // 承認者候補(指導者・管理者)の選択・申請者や承認者の表示名解決の両方に使う。
      // list_team_members()はロールを問わず呼び出せる(email/last_active_atのみ管理者限定)。
      supabase.rpc("list_team_members"),
    ]);
    let activePlayers = sortPlayers((p ?? []).filter((row) => row.status !== "OB・OG"));
    if (!isStaff) {
      const linkedIds = new Set((links ?? []).map((l) => l.player_id));
      activePlayers = activePlayers.filter((row) => linkedIds.has(row.id));
    }
    setPlayers(activePlayers);
    setTests(t ?? []);
    setTeamMembers(members ?? []);
    setSelectedTestId((cur) => cur ?? (t && t.length > 0 ? t[0].id : null));
    setLoading(false);
  }, [isStaff, userId]);

  useEffect(() => {
    if (!hasSkillTestAccess(plan)) return;
    load();
  }, [load, plan]);

  const loadProgress = useCallback(async () => {
    if (!hasSkillTestAccess(plan) || !selectedTestId) {
      setProgress([]);
      setRequests([]);
      return;
    }
    const supabase = createClient();
    const [{ data: prog }, { data: reqs }] = await Promise.all([
      supabase
        .from("player_skill_test_progress")
        .select("*")
        .eq("skill_test_id", selectedTestId)
        .order("created_at", { ascending: false }),
      supabase
        .from("skill_test_promotion_requests")
        .select("*")
        .eq("skill_test_id", selectedTestId)
        .order("created_at", { ascending: false }),
    ]);
    setProgress(prog ?? []);
    setRequests(reqs ?? []);
  }, [selectedTestId, plan]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  const selectedTest = tests.find((t) => t.id === selectedTestId) ?? null;
  // defaultLevelsは自動採番のみ(カスタム名編集画面のプレースホルダ用)、levelsはカスタム名を反映した表示用。
  const defaultLevels = selectedTest ? skillTestLevelLabels(selectedTest.kyu_count, selectedTest.dan_count) : [];
  const levels = selectedTest
    ? skillTestLevelLabels(selectedTest.kyu_count, selectedTest.dan_count, selectedTest.level_names)
    : [];
  const instructors = teamMembers.filter((m) => m.role === "指導者" || m.role === "管理者");

  function memberName(id: string) {
    return teamMembers.find((m) => m.id === id)?.name ?? "不明なメンバー";
  }

  function playerName(id: string) {
    const p = players.find((row) => row.id === id);
    return p ? playerFullName(p) : "不明な選手";
  }

  // 却下された申請に紐づくprogress行(級の即時反映分)は「現在のランク」の判定から除外する
  // (追記型ログのため行自体は消さない)。
  function latestFor(playerId: string) {
    const rejectedProgressIds = new Set(
      requests.filter((r) => r.status === "rejected" && r.progress_id).map((r) => r.progress_id),
    );
    return progress.find((row) => row.player_id === playerId && !rejectedProgressIds.has(row.id)) ?? null;
  }

  function pendingRequestFor(playerId: string) {
    return requests.find((row) => row.player_id === playerId && row.status === "pending") ?? null;
  }

  // 指導者・管理者が自分で編集する場合、この申請フローを経由せず直接反映する。
  async function handleStaffChangeLevel(playerId: string, indexStr: string) {
    if (!selectedTest || indexStr === "") return;
    setSavingPlayerId(playerId);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("player_skill_test_progress")
      .insert({
        team_id: teamId,
        player_id: playerId,
        skill_test_id: selectedTest.id,
        level_index: Number(indexStr),
        recorded_by: userId,
      })
      .select("*")
      .single();
    setSavingPlayerId(null);
    if (error || !data) {
      toast(`更新に失敗しました: ${error?.message ?? ""}`);
      return;
    }
    setProgress((prev) => [data, ...prev]);
  }

  function openRequestModal(player: Player) {
    setRequestPlayer(player);
    setRequestLevelIdx("");
    setRequestApproverId(instructors[0]?.id ?? "");
  }

  // 一般・運営からの申請。級は即時反映+事後承認、段は承認されるまで反映しない(ブロッキング)。
  async function submitRequest() {
    if (!selectedTest || !requestPlayer || requestLevelIdx === "" || !requestApproverId) return;
    const targetIndex = Number(requestLevelIdx);
    const isDan = targetIndex >= selectedTest.kyu_count;
    const label = levels[targetIndex];
    setSubmittingRequest(true);
    const supabase = createClient();

    if (!isDan) {
      const { data: progressRow, error: progressError } = await supabase
        .from("player_skill_test_progress")
        .insert({
          team_id: teamId,
          player_id: requestPlayer.id,
          skill_test_id: selectedTest.id,
          level_index: targetIndex,
          recorded_by: userId,
        })
        .select("*")
        .single();
      if (progressError || !progressRow) {
        setSubmittingRequest(false);
        toast(`更新に失敗しました: ${progressError?.message ?? ""}`);
        return;
      }
      const { error: reqError } = await supabase.from("skill_test_promotion_requests").insert({
        team_id: teamId,
        player_id: requestPlayer.id,
        skill_test_id: selectedTest.id,
        target_level_index: targetIndex,
        target_level_label: label,
        is_dan: false,
        progress_id: progressRow.id,
        requested_by: userId,
        approver_id: requestApproverId,
      });
      setSubmittingRequest(false);
      if (reqError) {
        toast(`申請の送信に失敗しました: ${reqError.message}`);
        return;
      }
      toast("ランクを更新し、承認を申請しました");
    } else {
      const { error: reqError } = await supabase.from("skill_test_promotion_requests").insert({
        team_id: teamId,
        player_id: requestPlayer.id,
        skill_test_id: selectedTest.id,
        target_level_index: targetIndex,
        target_level_label: label,
        is_dan: true,
        requested_by: userId,
        approver_id: requestApproverId,
      });
      setSubmittingRequest(false);
      if (reqError) {
        toast(`申請の送信に失敗しました: ${reqError.message}`);
        return;
      }
      toast("昇段申請を送信しました。承認をお待ちください");
    }
    setRequestPlayer(null);
    await loadProgress();
  }

  async function handleApprove(request: SkillTestPromotionRequest) {
    setDecidingId(request.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("skill_test_promotion_requests")
      .update({ status: "approved" })
      .eq("id", request.id);
    setDecidingId(null);
    if (error) {
      toast(`承認に失敗しました: ${error.message}`);
      return;
    }
    toast("承認しました");
    await loadProgress();
  }

  async function handleReject() {
    if (!rejectingRequest) return;
    if (!rejectReason.trim()) {
      toast("却下理由を入力してください");
      return;
    }
    setDecidingId(rejectingRequest.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("skill_test_promotion_requests")
      .update({ status: "rejected", reject_reason: rejectReason.trim() })
      .eq("id", rejectingRequest.id);
    setDecidingId(null);
    if (error) {
      toast(`却下に失敗しました: ${error.message}`);
      return;
    }
    toast("却下しました");
    setRejectingRequest(null);
    setRejectReason("");
    await loadProgress();
  }

  async function handleAddTest() {
    const name = newName.trim();
    const kyuCount = Number(newKyuCount);
    const danCount = Number(newDanCount);
    if (!name) {
      toast("検定名を入力してください");
      return;
    }
    if (
      !Number.isInteger(kyuCount) ||
      !Number.isInteger(danCount) ||
      kyuCount < 0 ||
      danCount < 0 ||
      kyuCount + danCount < 1
    ) {
      toast("級・段の数を正しく入力してください");
      return;
    }
    setAddingTest(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("skill_tests")
      .insert({ team_id: teamId, name, kyu_count: kyuCount, dan_count: danCount })
      .select("*")
      .single();
    setAddingTest(false);
    if (error || !data) {
      toast(`追加に失敗しました: ${error?.message ?? ""}`);
      return;
    }
    setNewName("");
    setNewKyuCount("10");
    setNewDanCount("5");
    setShowAddForm(false);
    setTests((prev) => [...prev, data]);
    setSelectedTestId(data.id);
  }

  function openLevelNameEditor() {
    if (!selectedTest) return;
    setLevelNameDrafts(defaultLevels.map((_, idx) => selectedTest.level_names[String(idx)] ?? ""));
    setEditingLevelNames(true);
  }

  async function saveLevelNames() {
    if (!selectedTest) return;
    setSavingLevelNames(true);
    const levelNames: Record<string, string> = {};
    levelNameDrafts.forEach((value, idx) => {
      const trimmed = value.trim();
      if (trimmed) levelNames[String(idx)] = trimmed;
    });
    const supabase = createClient();
    const { data, error } = await supabase
      .from("skill_tests")
      .update({ level_names: levelNames })
      .eq("id", selectedTest.id)
      .select("*")
      .single();
    setSavingLevelNames(false);
    if (error || !data) {
      toast(`保存に失敗しました: ${error?.message ?? ""}`);
      return;
    }
    setTests((prev) => prev.map((t) => (t.id === data.id ? data : t)));
    setEditingLevelNames(false);
    toast("レベル名を更新しました");
  }

  const pendingQueue = requests.filter((r) => r.status === "pending");
  const myRequests = requests.filter((r) => r.requested_by === userId);

  return (
    <PageShell header={<AppHeader title="検定" variant="detail" backHref="/karte/team" />}>
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : tests.length === 0 ? (
        <Card>
          <EmptyState>まだ検定がありません</EmptyState>
        </Card>
      ) : (
        <div className="mb-3">
          <FieldLabel>検定</FieldLabel>
          <InlineSelect
            value={selectedTestId ?? ""}
            onChange={setSelectedTestId}
            options={tests.map((t) => ({ value: t.id, label: t.name }))}
          />
          {isStaff && selectedTest && (
            <button
              type="button"
              onClick={openLevelNameEditor}
              className="mt-1.5 text-[11px] font-bold text-orange underline"
            >
              レベル名を編集
            </button>
          )}
        </div>
      )}

      {!loading && selectedTest && players.length === 0 && (
        <Card>
          <EmptyState>{isStaff ? "選手が登録されていません" : "紐づく選手が登録されていません"}</EmptyState>
        </Card>
      )}

      {!loading && selectedTest && players.length > 0 && (
        <div className="bg-white border border-line rounded-lg overflow-auto max-h-[65vh] mb-2.5">
          <table className="border-collapse text-[11.5px] w-full">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 h-11 bg-paper z-30 text-left px-2.5 border-b border-line whitespace-nowrap">
                  選手
                </th>
                <th className="sticky top-0 h-11 bg-paper z-20 text-left px-2.5 border-b border-line font-bold whitespace-nowrap text-ink-soft">
                  現在のランク
                </th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const current = latestFor(p.id);
                const pending = isStaff ? null : pendingRequestFor(p.id);
                return (
                  <tr key={p.id}>
                    <td className="sticky left-0 bg-white z-10 px-2.5 py-2 whitespace-nowrap border-b border-line last:border-b-0">
                      <Link href={`/karte/players/${p.id}`} className="font-bold">
                        #{p.number ?? "-"} {playerFullName(p)}
                      </Link>
                    </td>
                    <td className="px-2.5 py-1.5 border-b border-line last:border-b-0">
                      {isStaff ? (
                        // player_skill_test_progress_insertのRLSは指導者・管理者による
                        // 任意選手への直接記録を許可しているため、申請フローを経由させない。
                        <select
                          className="appearance-none bg-white border border-line rounded-lg px-2 py-1.5 text-[12px] font-bold text-ink w-full"
                          value={current ? String(current.level_index) : ""}
                          disabled={savingPlayerId === p.id}
                          onChange={(e) => handleStaffChangeLevel(p.id, e.target.value)}
                        >
                          <option value="">未設定</option>
                          {levels.map((label, idx) => (
                            <option key={idx} value={idx}>
                              {label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[12px]">{current ? current.level_label : "未設定"}</span>
                          {pending ? (
                            <Pill tone="pending">{pending.target_level_label}へ申請中</Pill>
                          ) : (
                            <button
                              type="button"
                              disabled={instructors.length === 0}
                              onClick={() => openRequestModal(p)}
                              className="text-[11px] font-bold text-orange underline disabled:opacity-40 disabled:no-underline"
                            >
                              ランクを申請
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !isStaff && instructors.length === 0 && selectedTest && players.length > 0 && (
        <div className="text-[11px] text-ink-soft mb-2.5">承認者となる指導者・管理者が登録されていないため、申請できません。</div>
      )}

      {!loading && selectedTest && !isStaff && myRequests.length > 0 && (
        <>
          <SectionLabel>あなたの申請状況</SectionLabel>
          <Card className="mb-2.5">
            <div className="flex flex-col gap-2.5">
              {myRequests.map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-2 text-[12px]">
                  <div>
                    <div className="font-bold">
                      {playerName(r.player_id)} ・ {r.target_level_label}
                      {r.is_dan ? "(承認制)" : ""}
                    </div>
                    <div className="text-[11px] text-ink-soft mt-0.5">承認者: {memberName(r.approver_id)}</div>
                    {r.status === "rejected" && r.reject_reason && (
                      <div className="text-[11px] text-danger mt-0.5">却下理由: {r.reject_reason}</div>
                    )}
                  </div>
                  <Pill tone={r.status === "approved" ? "ok" : r.status === "rejected" ? "absent" : "pending"}>
                    {r.status === "approved" ? "承認済み" : r.status === "rejected" ? "却下" : "承認待ち"}
                  </Pill>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {!loading && selectedTest && isStaff && pendingQueue.length > 0 && (
        <>
          <SectionLabel>承認待ちの申請</SectionLabel>
          <Card className="mb-2.5">
            <div className="flex flex-col gap-3">
              {pendingQueue.map((r) => {
                const isMine = r.approver_id === userId;
                return (
                  <div key={r.id} className="flex items-start justify-between gap-2 text-[12px]">
                    <div>
                      <div className="font-bold">
                        {playerName(r.player_id)} ・ {r.target_level_label}
                        {r.is_dan ? "(段・要承認)" : "(級・事後承認)"}
                      </div>
                      <div className="text-[11px] text-ink-soft mt-0.5">
                        申請者: {memberName(r.requested_by)} ／ 承認者: {memberName(r.approver_id)}
                      </div>
                    </div>
                    {isMine ? (
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          disabled={decidingId === r.id}
                          onClick={() => handleApprove(r)}
                          className="px-2.5 py-1 rounded-lg font-bold text-[11px] border border-orange text-orange disabled:opacity-50"
                        >
                          承認
                        </button>
                        <button
                          type="button"
                          disabled={decidingId === r.id}
                          onClick={() => {
                            setRejectingRequest(r);
                            setRejectReason("");
                          }}
                          className="px-2.5 py-1 rounded-lg font-bold text-[11px] border border-line text-ink-soft disabled:opacity-50"
                        >
                          却下
                        </button>
                      </div>
                    ) : (
                      <Pill tone="watch">承認待ち</Pill>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}

      {!loading &&
        isStaff &&
        (showAddForm ? (
          <Card>
            <FieldLabel>検定名</FieldLabel>
            <input
              className={inputClass()}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="例:ドリブル検定"
            />
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
        ))}

      <Modal open={!!requestPlayer} onClose={() => setRequestPlayer(null)} title="ランクを申請">
        {requestPlayer && selectedTest && (
          <>
            <div className="text-[12.5px] font-bold mb-3">{playerFullName(requestPlayer)}</div>
            <FieldLabel>申請するランク</FieldLabel>
            <select
              className={inputClass()}
              value={requestLevelIdx}
              onChange={(e) => setRequestLevelIdx(e.target.value)}
            >
              <option value="">選択してください</option>
              {levels.map((label, idx) => (
                <option key={idx} value={idx}>
                  {label}
                  {idx >= selectedTest.kyu_count ? "(要承認)" : ""}
                </option>
              ))}
            </select>
            <div className="mt-3">
              <FieldLabel>承認者(指導者・管理者から1名選択)</FieldLabel>
              <select
                className={inputClass()}
                value={requestApproverId}
                onChange={(e) => setRequestApproverId(e.target.value)}
              >
                {instructors.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}({m.role})
                  </option>
                ))}
              </select>
            </div>
            <div className="text-[11px] text-ink-soft mt-3">
              {requestLevelIdx !== "" && Number(requestLevelIdx) >= selectedTest.kyu_count
                ? "段への昇格は、承認されるまでランクに反映されません。"
                : "級は申請と同時にランクへ反映されますが、承認者による事後確認の対象になります。"}
            </div>
            <SubmitButton
              onClick={submitRequest}
              disabled={submittingRequest || requestLevelIdx === "" || !requestApproverId}
            >
              {submittingRequest ? "送信中…" : "申請する"}
            </SubmitButton>
          </>
        )}
      </Modal>

      <Modal open={editingLevelNames} onClose={() => setEditingLevelNames(false)} title="レベル名を編集">
        {selectedTest && (
          <>
            <div className="text-[11px] text-ink-soft mb-3">
              空欄のまま保存すると、そのランクは自動採番のラベル(例:{defaultLevels[0] ?? "3級"})のままになります。
            </div>
            <div className="flex flex-col gap-2">
              {defaultLevels.map((defaultLabel, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-[11px] text-ink-soft w-12 flex-shrink-0">{defaultLabel}</span>
                  <input
                    className={inputClass("flex-1")}
                    value={levelNameDrafts[idx] ?? ""}
                    onChange={(e) =>
                      setLevelNameDrafts((prev) => {
                        const next = [...prev];
                        next[idx] = e.target.value;
                        return next;
                      })
                    }
                    placeholder={defaultLabel}
                  />
                </div>
              ))}
            </div>
            <SubmitButton onClick={saveLevelNames} disabled={savingLevelNames}>
              {savingLevelNames ? "保存中…" : "保存する"}
            </SubmitButton>
          </>
        )}
      </Modal>

      <Modal open={!!rejectingRequest} onClose={() => setRejectingRequest(null)} title="申請を却下">
        {rejectingRequest && (
          <>
            <div className="text-[12.5px] font-bold mb-3">
              {playerName(rejectingRequest.player_id)} ・ {rejectingRequest.target_level_label}
            </div>
            <FieldLabel>却下理由</FieldLabel>
            <textarea
              className={inputClass()}
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="却下する理由を入力してください"
            />
            <SubmitButton onClick={handleReject} disabled={decidingId === rejectingRequest.id || !rejectReason.trim()}>
              {decidingId === rejectingRequest.id ? "送信中…" : "却下する"}
            </SubmitButton>
          </>
        )}
      </Modal>
    </PageShell>
  );
}
