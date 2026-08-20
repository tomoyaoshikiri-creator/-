"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState } from "@/components/ui/Card";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { ChevronRightIcon } from "@/components/icons";
import { canViewKarte } from "@/lib/permissions";
import { hasSkillTestAccess } from "@/lib/plan";
import { skillTestLevelLabels } from "@/lib/skillTest";
import { playerFullName, sortPlayers } from "@/lib/format";
import type { Player, PlayerSkillTestProgress, SkillTest } from "@/lib/database.types";

export default function KarteTeamSkillTestsPage() {
  const router = useRouter();
  const { role, teamId, plan } = useSession();
  const toast = useToast();
  const isStaff = canViewKarte(role);

  useEffect(() => {
    if (!hasSkillTestAccess(plan) || !isStaff) router.replace("/karte/team");
  }, [plan, isStaff, router]);

  const [players, setPlayers] = useState<Player[]>([]);
  const [tests, setTests] = useState<SkillTest[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [progress, setProgress] = useState<PlayerSkillTestProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPlayerId, setSavingPlayerId] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKyuCount, setNewKyuCount] = useState("10");
  const [newDanCount, setNewDanCount] = useState("5");
  const [addingTest, setAddingTest] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: p }, { data: t }] = await Promise.all([
      supabase.from("players").select("*"),
      supabase.from("skill_tests").select("*").order("created_at", { ascending: true }),
    ]);
    const activePlayers = sortPlayers((p ?? []).filter((row) => row.status !== "OB・OG"));
    setPlayers(activePlayers);
    setTests(t ?? []);
    setSelectedTestId((cur) => cur ?? (t && t.length > 0 ? t[0].id : null));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedTestId) {
      setProgress([]);
      return;
    }
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("player_skill_test_progress")
        .select("*")
        .eq("skill_test_id", selectedTestId)
        .order("created_at", { ascending: false });
      setProgress(data ?? []);
    })();
  }, [selectedTestId]);

  const selectedTest = tests.find((t) => t.id === selectedTestId) ?? null;
  const levels = selectedTest ? skillTestLevelLabels(selectedTest.kyu_count, selectedTest.dan_count) : [];

  function latestFor(playerId: string) {
    return progress.find((row) => row.player_id === playerId) ?? null;
  }

  async function handleChangeLevel(playerId: string, indexStr: string) {
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

  return (
    <PageShell header={<AppHeader title="検定" variant="detail" backHref="/karte/team" accessBadge="coach" />}>
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : tests.length === 0 ? (
        <Card>
          <EmptyState>まだ検定がありません</EmptyState>
        </Card>
      ) : (
        <div className="mb-3">
          <FieldLabel>検定</FieldLabel>
          <div className="relative inline-block">
            <select
              className="appearance-none bg-white border border-line rounded-[10px] pl-3 pr-8 py-1.5 text-[12.5px] font-bold text-ink"
              value={selectedTestId ?? ""}
              onChange={(e) => setSelectedTestId(e.target.value)}
            >
              {tests.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
          </div>
        </div>
      )}

      {!loading && selectedTest && (
        <div className="bg-white border border-line rounded-2xl overflow-auto max-h-[65vh] mb-2.5">
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
                return (
                  <tr key={p.id}>
                    <td className="sticky left-0 bg-white z-10 px-2.5 py-2 whitespace-nowrap border-b border-line last:border-b-0">
                      <Link href={`/karte/players/${p.id}`} className="font-bold">
                        #{p.number ?? "-"} {playerFullName(p)}
                      </Link>
                    </td>
                    <td className="px-2.5 py-1.5 border-b border-line last:border-b-0">
                      <select
                        className="appearance-none bg-white border border-line rounded-[8px] px-2 py-1.5 text-[12px] font-bold text-ink w-full"
                        value={current ? String(current.level_index) : ""}
                        disabled={savingPlayerId === p.id}
                        onChange={(e) => handleChangeLevel(p.id, e.target.value)}
                      >
                        <option value="">未設定</option>
                        {levels.map((label, idx) => (
                          <option key={idx} value={idx}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading &&
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
                className="flex-1 text-center py-2.5 rounded-[10px] font-bold text-[13px] border border-line text-ink-soft bg-white"
              >
                キャンセル
              </button>
            </div>
          </Card>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="block w-full mb-2.5 text-center py-2 rounded-[10px] font-bold text-[12px] border border-line text-ink-soft bg-white"
          >
            + 検定を追加
          </button>
        ))}
    </PageShell>
  );
}
