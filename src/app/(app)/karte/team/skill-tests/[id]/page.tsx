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
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { Modal } from "@/components/ui/Modal";
import { Pill } from "@/components/ui/Pill";
import { canViewKarte } from "@/lib/permissions";
import { hasSkillTestAccess } from "@/lib/plan";
import { isSkillTestDanCrossing, skillTestLevelLabels } from "@/lib/skillTest";
import { playerFullName, sortPlayers } from "@/lib/format";
import type { Player, PlayerSkillTestProgress, SkillTest, SkillTestPromotionRequest, TeamMember } from "@/lib/database.types";

export default function KarteTeamSkillTestDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { role, teamId, plan, userId } = useSession();
  const toast = useToast();
  const isStaff = canViewKarte(role);

  useEffect(() => {
    if (!hasSkillTestAccess(plan)) router.replace("/karte/team");
  }, [plan, router]);

  const [test, setTest] = useState<SkillTest | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [progress, setProgress] = useState<PlayerSkillTestProgress[]>([]);
  const [requests, setRequests] = useState<SkillTestPromotionRequest[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPlayerId, setSavingPlayerId] = useState<string | null>(null);

  // 申請モーダル(一般・運営専用): 選手を選んでランクと承認者を指定し、申請する。
  const [requestPlayer, setRequestPlayer] = useState<Player | null>(null);
  const [requestLevelIdx, setRequestLevelIdx] = useState("");
  const [requestApproverId, setRequestApproverId] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // 承認キュー(指導者・管理者向け): 却下時のみ理由コメントの入力を求める。
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [rejectingRequest, setRejectingRequest] = useState<SkillTestPromotionRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // 検定の設定編集(指導者・管理者向け): 級の呼び方、段(チャプター)の一覧、各レベルの任意の
  // 名前、検定自体の削除を行える。
  const [editingSettings, setEditingSettings] = useState(false);
  const [kyuLabelDraft, setKyuLabelDraft] = useState("級");
  const [chapterDrafts, setChapterDrafts] = useState<{ name: string; kyuCount: string }[]>([]);
  const [levelNameDrafts, setLevelNameDrafts] = useState<string[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletingTest, setDeletingTest] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: t }, { data: p }, { data: links }, { data: members }] = await Promise.all([
      supabase.from("skill_tests").select("*").eq("id", params.id).maybeSingle(),
      supabase.from("players").select("*"),
      // 一般・運営は自分に紐づく選手の分しか見られない(player_skill_test_progressの
      // RLSと同じ方針)。playersテーブル自体はRLS上チーム全員分が見えてしまうため、
      // 選手一覧はここでクライアント側から絞り込む。
      isStaff ? Promise.resolve({ data: null }) : supabase.from("player_guardians").select("player_id").eq("profile_id", userId),
      // 承認者候補(指導者・管理者)の選択・申請者や承認者の表示名解決の両方に使う。
      // list_team_members()はロールを問わず呼び出せる(email/last_active_atのみ管理者限定)。
      supabase.rpc("list_team_members"),
    ]);
    setTest(t ?? null);
    let activePlayers = sortPlayers((p ?? []).filter((row) => row.status !== "OB・OG"));
    if (!isStaff) {
      const linkedIds = new Set((links ?? []).map((l) => l.player_id));
      activePlayers = activePlayers.filter((row) => linkedIds.has(row.id));
    }
    setPlayers(activePlayers);
    setTeamMembers(members ?? []);
    setLoading(false);
  }, [params.id, isStaff, userId]);

  useEffect(() => {
    if (!hasSkillTestAccess(plan)) return;
    load();
  }, [load, plan]);

  const loadProgress = useCallback(async () => {
    if (!hasSkillTestAccess(plan)) {
      setProgress([]);
      setRequests([]);
      return;
    }
    const supabase = createClient();
    const [{ data: prog }, { data: reqs }] = await Promise.all([
      supabase
        .from("player_skill_test_progress")
        .select("*")
        .eq("skill_test_id", params.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("skill_test_promotion_requests")
        .select("*")
        .eq("skill_test_id", params.id)
        .order("created_at", { ascending: false }),
    ]);
    setProgress(prog ?? []);
    setRequests(reqs ?? []);
  }, [params.id, plan]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  // defaultLevelsは自動採番のみ(設定編集画面のプレースホルダ用)、levelsはカスタム名を反映した表示用。
  const defaultLevels = test
    ? skillTestLevelLabels(
        test.kyu_count,
        test.dan_count,
        null,
        test.dan_kyu_count,
        test.kyu_label,
        test.dan_label,
        test.chapters,
      )
    : [];
  const levels = test
    ? skillTestLevelLabels(
        test.kyu_count,
        test.dan_count,
        test.level_names,
        test.dan_kyu_count,
        test.kyu_label,
        test.dan_label,
        test.chapters,
      )
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
    if (!test || indexStr === "") return;
    setSavingPlayerId(playerId);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("player_skill_test_progress")
      .insert({
        team_id: teamId,
        player_id: playerId,
        skill_test_id: test.id,
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
    if (!test || !requestPlayer || requestLevelIdx === "" || !requestApproverId) return;
    const targetIndex = Number(requestLevelIdx);
    // 段(チャプター)そのものへの昇格(新しい段/チャプターへの突入)だけが要承認のブロッキング
    // 対象。同じ段/チャプターの中の級への昇格は、これまでの級と同じ即時反映+事後承認。
    const isDan = isSkillTestDanCrossing(test.kyu_count, test.dan_kyu_count, targetIndex, test.chapters);
    const label = levels[targetIndex];
    setSubmittingRequest(true);
    const supabase = createClient();

    if (!isDan) {
      const { data: progressRow, error: progressError } = await supabase
        .from("player_skill_test_progress")
        .insert({
          team_id: teamId,
          player_id: requestPlayer.id,
          skill_test_id: test.id,
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
        skill_test_id: test.id,
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
        skill_test_id: test.id,
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

  function openSettingsEditor() {
    if (!test) return;
    // kyu_label/dan_label/chaptersは後発のマイグレーションで追加した列のため、未適用の環境
    // (マイグレーション未実行のDB)ではundefinedで返ってくることがある。その場合でも
    // モーダルが開けるよう、既定値にフォールバックする。
    setKyuLabelDraft(test.kyu_label ?? "級");
    setChapterDrafts((test.chapters ?? []).map((c) => ({ name: c.name, kyuCount: String(c.kyu_count) })));
    setLevelNameDrafts(defaultLevels.map((_, idx) => test.level_names[String(idx)] ?? ""));
    setConfirmingDelete(false);
    setEditingSettings(true);
  }

  // チャプターの追加・削除・級数変更は各段の区切り(level_index)自体を変えるため、級側
  // (既存のまま)のカスタム名は引き継ぎつつ、段側のカスタム名はいったんリセットする
  // (チャプター名だけの変更はlevel_indexに影響しないため、この関数は呼ばない)。
  function resetDanLevelNameDrafts(chapters: { name: string; kyuCount: string }[]) {
    if (!test) return;
    const newDefaults = skillTestLevelLabels(
      test.kyu_count,
      test.dan_count,
      null,
      0,
      kyuLabelDraft || "級",
      "段",
      chapters.map((c) => ({ name: c.name, kyu_count: Number(c.kyuCount) || 0 })),
    );
    setLevelNameDrafts((prev) => newDefaults.map((_, idx) => (idx < test.kyu_count ? (prev[idx] ?? "") : "")));
  }

  function addChapterDraft() {
    setChapterDrafts((prev) => {
      const next = [...prev, { name: "", kyuCount: "10" }];
      resetDanLevelNameDrafts(next);
      return next;
    });
  }

  function removeChapterDraft(idx: number) {
    setChapterDrafts((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      resetDanLevelNameDrafts(next);
      return next;
    });
  }

  function updateChapterName(idx: number, name: string) {
    setChapterDrafts((prev) => prev.map((row, i) => (i === idx ? { ...row, name } : row)));
  }

  function updateChapterKyuCount(idx: number, kyuCount: string) {
    setChapterDrafts((prev) => {
      const next = prev.map((row, i) => (i === idx ? { ...row, kyuCount } : row));
      resetDanLevelNameDrafts(next);
      return next;
    });
  }

  async function saveSettings() {
    if (!test) return;
    const kyuLabel = kyuLabelDraft.trim();
    if (!kyuLabel || kyuLabel.length > 10) {
      toast("級の呼び方を正しく入力してください");
      return;
    }
    if (chapterDrafts.some((c) => !c.name.trim() || c.name.trim().length > 20)) {
      toast("チャプター名を正しく入力してください");
      return;
    }
    if (
      chapterDrafts.some((c) => !Number.isInteger(Number(c.kyuCount)) || Number(c.kyuCount) < 1 || Number(c.kyuCount) > 30)
    ) {
      toast("チャプター内の級数を正しく入力してください");
      return;
    }
    setSavingSettings(true);
    const levelNames: Record<string, string> = {};
    levelNameDrafts.forEach((value, idx) => {
      const trimmed = value.trim();
      if (trimmed) levelNames[String(idx)] = trimmed;
    });
    const supabase = createClient();
    const { data, error } = await supabase
      .from("skill_tests")
      .update({
        kyu_label: kyuLabel,
        chapters: chapterDrafts.map((c) => ({ name: c.name.trim(), kyu_count: Number(c.kyuCount) })),
        level_names: levelNames,
      })
      .eq("id", test.id)
      .select("*")
      .single();
    setSavingSettings(false);
    if (error || !data) {
      toast(`保存に失敗しました: ${error?.message ?? ""}`);
      return;
    }
    setTest(data);
    setEditingSettings(false);
    toast("検定の設定を更新しました");
  }

  // 検定自体の削除(記録・申請もon delete cascadeで一緒に消える)。誤タップ防止のため2回タップで確定する。
  async function handleDeleteTest() {
    if (!test) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setDeletingTest(true);
    const supabase = createClient();
    const { error } = await supabase.from("skill_tests").delete().eq("id", test.id);
    setDeletingTest(false);
    if (error) {
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    toast("検定を削除しました");
    router.push("/karte/team/skill-tests");
  }

  const pendingQueue = requests.filter((r) => r.status === "pending");
  const myRequests = requests.filter((r) => r.requested_by === userId);

  return (
    <PageShell
      header={
        <AppHeader title={test ? test.name : "検定"} variant="detail" backHref="/karte/team/skill-tests" />
      }
    >
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : !test ? (
        <Card>
          <EmptyState>検定が見つかりません</EmptyState>
        </Card>
      ) : (
        <>
          {isStaff && (
            <button
              type="button"
              onClick={openSettingsEditor}
              className="mb-3 text-[11px] font-bold text-orange underline"
            >
              設定を編集
            </button>
          )}

          {players.length === 0 ? (
            <Card>
              <EmptyState>{isStaff ? "選手が登録されていません" : "紐づく選手が登録されていません"}</EmptyState>
            </Card>
          ) : (
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

          {!isStaff && instructors.length === 0 && players.length > 0 && (
            <div className="text-[11px] text-ink-soft mb-2.5">承認者となる指導者・管理者が登録されていないため、申請できません。</div>
          )}

          {!isStaff && myRequests.length > 0 && (
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

          {isStaff && pendingQueue.length > 0 && (
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
        </>
      )}

      <Modal open={!!requestPlayer} onClose={() => setRequestPlayer(null)} title="ランクを申請">
        {requestPlayer && test && (
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
                  {isSkillTestDanCrossing(test.kyu_count, test.dan_kyu_count, idx, test.chapters) ? "(要承認)" : ""}
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
              {requestLevelIdx !== "" &&
              isSkillTestDanCrossing(test.kyu_count, test.dan_kyu_count, Number(requestLevelIdx), test.chapters)
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

      <Modal open={editingSettings} onClose={() => setEditingSettings(false)} title="設定を編集">
        {test &&
          (() => {
            const draftDefaultLevels = skillTestLevelLabels(
              test.kyu_count,
              test.dan_count,
              null,
              0,
              kyuLabelDraft || "級",
              "段",
              chapterDrafts.map((c) => ({ name: c.name, kyu_count: Number(c.kyuCount) || 0 })),
            );
            return (
              <>
                <FieldLabel>級の呼び方</FieldLabel>
                <input
                  className={inputClass()}
                  value={kyuLabelDraft}
                  onChange={(e) => setKyuLabelDraft(e.target.value)}
                  maxLength={10}
                />
                <div className="text-[11px] text-ink-soft mt-1 mb-3">
                  下のチャプターに入る前段階の級(現在{test.kyu_count}{kyuLabelDraft || "級"})の呼び方にも使われます。
                </div>

                <FieldLabel>チャプター(段)</FieldLabel>
                <div className="text-[11px] text-ink-soft mb-2">
                  「スタート編」「入門編」のように名前を付け、それぞれの中の級の数を個別に設定できます(例:スタート編=4{kyuLabelDraft || "級"}まで、入門編=10{kyuLabelDraft || "級"}まで)。次のチャプターへ進む昇格のみ要承認で、チャプター内の{kyuLabelDraft || "級"}への昇格はこれまでの{kyuLabelDraft || "級"}と同じ扱いになります。
                </div>
                <div className="flex flex-col gap-2 mb-2">
                  {chapterDrafts.map((c, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        className={inputClass("flex-1")}
                        value={c.name}
                        onChange={(e) => updateChapterName(idx, e.target.value)}
                        placeholder="例:スタート編"
                        maxLength={20}
                      />
                      <input
                        type="number"
                        min={1}
                        max={30}
                        className={inputClass("w-16 flex-none")}
                        value={c.kyuCount}
                        onChange={(e) => updateChapterKyuCount(idx, e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => removeChapterDraft(idx)}
                        className="flex-none w-8 h-8 rounded-lg border border-line text-ink-soft font-bold"
                        aria-label="このチャプターを削除"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addChapterDraft}
                  className="w-full text-center py-2 rounded-lg font-bold text-[12px] border border-line text-ink-soft bg-white"
                >
                  + チャプターを追加
                </button>

                <div className="mt-4">
                  <FieldLabel>レベル名(空欄は自動採番のまま)</FieldLabel>
                  <div className="flex flex-col gap-2">
                    {draftDefaultLevels.map((defaultLabel, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-[11px] text-ink-soft w-16 flex-shrink-0">{defaultLabel}</span>
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
                </div>
                <SubmitButton onClick={saveSettings} disabled={savingSettings}>
                  {savingSettings ? "保存中…" : "保存する"}
                </SubmitButton>
                <button
                  type="button"
                  onClick={handleDeleteTest}
                  disabled={deletingTest}
                  className="mt-3 w-full text-center py-2.5 rounded-lg font-bold text-[13px] border bg-white disabled:opacity-50"
                  style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                >
                  {deletingTest ? "削除中…" : confirmingDelete ? "本当に削除しますか?(記録もすべて消えます・もう一度タップで削除)" : "この検定を削除"}
                </button>
              </>
            );
          })()}
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
