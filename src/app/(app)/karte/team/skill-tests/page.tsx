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
  const [newKyuCount, setNewKyuCount] = useState("10");
  const [newDanCount, setNewDanCount] = useState("5");
  const [newDanKyuCount, setNewDanKyuCount] = useState("0");
  const [newKyuLabel, setNewKyuLabel] = useState("級");
  const [newDanLabel, setNewDanLabel] = useState("段");
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

  async function handleAddTest() {
    const name = newName.trim();
    const kyuCount = Number(newKyuCount);
    const danCount = Number(newDanCount);
    const danKyuCount = Number(newDanKyuCount);
    const kyuLabel = newKyuLabel.trim();
    const danLabel = newDanLabel.trim();
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
    if (!Number.isInteger(danKyuCount) || danKyuCount < 0 || danKyuCount > 30) {
      toast("段内の級数を正しく入力してください");
      return;
    }
    if (!kyuLabel || kyuLabel.length > 10 || !danLabel || danLabel.length > 10) {
      toast("級・段の呼び方を正しく入力してください");
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
        dan_count: danCount,
        dan_kyu_count: danKyuCount,
        kyu_label: kyuLabel,
        dan_label: danLabel,
      })
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
    setNewDanKyuCount("0");
    setNewKyuLabel("級");
    setNewDanLabel("段");
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
              <div className="mt-3">
                <FieldLabel>段内の級数(任意)</FieldLabel>
                <input
                  type="number"
                  min={0}
                  max={30}
                  className={inputClass()}
                  value={newDanKyuCount}
                  onChange={(e) => setNewDanKyuCount(e.target.value)}
                  placeholder="0"
                />
                <div className="text-[11px] text-ink-soft mt-1">
                  各段の中にも級を作りたい場合のみ入力してください(例:3→初段1級〜初段3級)。あとから変更もできます。
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <div className="flex-1">
                  <FieldLabel>級の呼び方</FieldLabel>
                  <input
                    className={inputClass()}
                    value={newKyuLabel}
                    onChange={(e) => setNewKyuLabel(e.target.value)}
                    maxLength={10}
                  />
                </div>
                <div className="flex-1">
                  <FieldLabel>段の呼び方</FieldLabel>
                  <input
                    className={inputClass()}
                    value={newDanLabel}
                    onChange={(e) => setNewDanLabel(e.target.value)}
                    maxLength={10}
                  />
                </div>
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
