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
import { Fab, Modal } from "@/components/ui/Modal";
import { ChevronRightIcon } from "@/components/icons";
import { canViewKarte } from "@/lib/permissions";
import { hasSkillTestAccess } from "@/lib/plan";
import type { SkillTest } from "@/lib/database.types";

type ChapterDraft = { name: string; kyuCount: string };

// 検定の一覧(名前タップで各検定の詳細・ランク編集画面へ)。検定自体の追加は+ボタンから。
export default function KarteTeamSkillTestsPage() {
  const router = useRouter();
  const { teamId, role, plan } = useSession();
  const toast = useToast();
  const isStaff = canViewKarte(role);

  useEffect(() => {
    if (!hasSkillTestAccess(plan)) router.replace("/karte/team");
  }, [plan, router]);

  const [tests, setTests] = useState<SkillTest[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKyuCount, setNewKyuCount] = useState("0");
  const [newKyuLabel, setNewKyuLabel] = useState("級");
  // チャプター(段): 「スタート編」「入門編」のように名前と、その中の級の数を個別に持つ。
  const [chapterDrafts, setChapterDrafts] = useState<ChapterDraft[]>([]);
  const [addingTest, setAddingTest] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: t } = await supabase.from("skill_tests").select("*").order("created_at", { ascending: true });
    setTests(t ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!hasSkillTestAccess(plan)) return;
    load();
  }, [load, plan]);

  function resetAddForm() {
    setNewName("");
    setNewKyuCount("0");
    setNewKyuLabel("級");
    setChapterDrafts([]);
  }

  async function handleAddTest() {
    const name = newName.trim();
    const kyuCount = Number(newKyuCount);
    const kyuLabel = newKyuLabel.trim();
    if (!name) {
      toast("検定名を入力してください");
      return;
    }
    if (!Number.isInteger(kyuCount) || kyuCount < 0 || kyuCount > 30) {
      toast("級の数を正しく入力してください");
      return;
    }
    if (!kyuLabel || kyuLabel.length > 10) {
      toast("級の呼び方を正しく入力してください");
      return;
    }
    if (chapterDrafts.some((c) => !c.name.trim() || c.name.trim().length > 20)) {
      toast("チャプター名を正しく入力してください");
      return;
    }
    if (chapterDrafts.some((c) => !Number.isInteger(Number(c.kyuCount)) || Number(c.kyuCount) < 1 || Number(c.kyuCount) > 30)) {
      toast("チャプター内の級数を正しく入力してください");
      return;
    }
    if (kyuCount === 0 && chapterDrafts.length === 0) {
      toast("級の数かチャプターのどちらかを設定してください");
      return;
    }
    setAddingTest(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("skill_tests")
      .insert({
        team_id: teamId,
        name,
        kyu_count: kyuCount,
        kyu_label: kyuLabel,
        // dan_count/dan_kyu_countはチャプター未使用時のみのフォールバック用。列の既定値(dan_count=5)
        // に頼ると、あとでチャプターを全部消したときに意図せず旧来の段が復活してしまうため、
        // このフォームで作る検定では明示的に0にしておく。
        dan_count: 0,
        dan_kyu_count: 0,
        chapters: chapterDrafts.map((c) => ({ name: c.name.trim(), kyu_count: Number(c.kyuCount) })),
      })
      .select("*")
      .single();
    setAddingTest(false);
    if (error || !data) {
      toast(`追加に失敗しました: ${error?.message ?? ""}`);
      return;
    }
    resetAddForm();
    setModalOpen(false);
    setTests((prev) => [...prev, data]);
    toast("検定を追加しました");
  }

  return (
    <PageShell
      header={<AppHeader title="検定管理" variant="list" backHref="/team" />}
      fab={
        isStaff && (
          <>
            <Fab onClick={() => setModalOpen(true)} />
            <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="検定を追加">
              <FieldLabel>検定名</FieldLabel>
              <input
                className={inputClass()}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="例:ドリブル検定"
              />
              <div className="mt-3 flex gap-2">
                <div className="flex-1">
                  <FieldLabel>級の数(任意)</FieldLabel>
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
                  <FieldLabel>級の呼び方</FieldLabel>
                  <input
                    className={inputClass()}
                    value={newKyuLabel}
                    onChange={(e) => setNewKyuLabel(e.target.value)}
                    maxLength={10}
                  />
                </div>
              </div>
              <div className="text-[11px] text-ink-soft mt-1">
                下のチャプターに入る前段階の級です。不要であれば0のままで構いません。
              </div>

              <div className="mt-4">
                <FieldLabel>チャプター(任意)</FieldLabel>
                <div className="text-[11px] text-ink-soft mb-2">
                  「スタート編」「入門編」のように名前を付け、それぞれの中の級の数を個別に設定できます(例:スタート編=4級まで、入門編=10級まで)。
                </div>
                <div className="flex flex-col gap-2">
                  {chapterDrafts.map((c, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        className={inputClass("flex-1")}
                        value={c.name}
                        onChange={(e) =>
                          setChapterDrafts((prev) => prev.map((row, i) => (i === idx ? { ...row, name: e.target.value } : row)))
                        }
                        placeholder="例:スタート編"
                        maxLength={20}
                      />
                      <input
                        type="number"
                        min={1}
                        max={30}
                        className={inputClass("w-16 flex-none")}
                        value={c.kyuCount}
                        onChange={(e) =>
                          setChapterDrafts((prev) =>
                            prev.map((row, i) => (i === idx ? { ...row, kyuCount: e.target.value } : row)),
                          )
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setChapterDrafts((prev) => prev.filter((_, i) => i !== idx))}
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
                  onClick={() => setChapterDrafts((prev) => [...prev, { name: "", kyuCount: "10" }])}
                  className="mt-2 w-full text-center py-2 rounded-lg font-bold text-[12px] border border-line text-ink-soft bg-white"
                >
                  + チャプターを追加
                </button>
              </div>

              <SubmitButton onClick={handleAddTest} disabled={addingTest}>
                {addingTest ? "追加中…" : "追加する"}
              </SubmitButton>
            </Modal>
          </>
        )
      }
    >
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : tests.length === 0 ? (
        <Card>
          <EmptyState>まだ検定がありません</EmptyState>
        </Card>
      ) : (
        tests.map((t) => (
          <Link key={t.id} href={`/karte/team/skill-tests/${t.id}`}>
            <Card className="cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="font-bold text-[14px]">{t.name}</div>
                <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
              </div>
            </Card>
          </Link>
        ))
      )}
    </PageShell>
  );
}
