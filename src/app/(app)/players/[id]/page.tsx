"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { FieldLabel, SegButton, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { ChevronRightIcon } from "@/components/icons";
import { GRADES, POSITIONS_BY_SPORT, STATUS_OPTIONS } from "@/lib/playerOptions";
import { formatFullDateLabel, gradeLabel, obogCohortLabel, playerFullName, sortPlayers } from "@/lib/format";
import { canManagePlayers } from "@/lib/permissions";
import { hasKarteTabAccess } from "@/lib/plan";
import { LockedFeatureCard } from "@/components/PlanLock";
import { useUnsavedChangesGuard } from "@/lib/navigationGuard";
import { BirthdaySelect } from "../BirthdaySelect";
import type { Grade, Player, PlayerStatus, Position } from "@/lib/database.types";

export default function PlayerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { role, userId, plan, sport } = useSession();
  const isStaff = canManagePlayers(role);
  const hasKarte = hasKarteTabAccess(plan);
  const positionOptions = POSITIONS_BY_SPORT[sport];
  const toast = useToast();
  const [player, setPlayer] = useState<Player | null>(null);
  const [noteCount, setNoteCount] = useState(0);
  const [prevId, setPrevId] = useState<string | null>(null);
  const [nextId, setNextId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [sei, setSei] = useState("");
  const [mei, setMei] = useState("");
  const [seiKana, setSeiKana] = useState("");
  const [meiKana, setMeiKana] = useState("");
  const [grade, setGrade] = useState("");
  const [number, setNumber] = useState("");
  const [positions, setPositions] = useState<Position[]>([]);
  const [status, setStatus] = useState<PlayerStatus>("在籍");
  const [birthday, setBirthday] = useState("");

  useUnsavedChangesGuard(
    editing &&
      player !== null &&
      (sei !== player.sei ||
        mei !== player.mei ||
        seiKana !== (player.sei_kana ?? "") ||
        meiKana !== (player.mei_kana ?? "") ||
        grade !== (player.grade ?? "") ||
        number !== (player.number ?? "") ||
        JSON.stringify([...positions].sort()) !== JSON.stringify([...player.positions].sort()) ||
        status !== player.status ||
        birthday !== (player.birthday ?? "")),
  );

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    const [{ data: p }, { count }] = await Promise.all([
      supabase.from("players").select("*").eq("id", params.id).single(),
      supabase
        .from("player_notes")
        .select("id", { count: "exact", head: true })
        .eq("player_id", params.id),
    ]);
    setPlayer(p ?? null);
    setNoteCount(count ?? 0);

    if (p) {
      const { data: siblings } = await supabase
        .from("players")
        .select("id, grade, number")
        .eq("status", p.status);
      const ordered = sortPlayers(siblings ?? []);
      const idx = ordered.findIndex((s) => s.id === p.id);
      setPrevId(idx > 0 ? ordered[idx - 1].id : null);
      setNextId(idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1].id : null);
    } else {
      setPrevId(null);
      setNextId(null);
    }
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  // playersテーブルは一般・運営にもチーム全選手のselectを開放しているため、
  // 選手一覧側のグレーアウトを迂回してURL直打ちされた場合に備え、ここでも
  // 「自分の子どもかどうか」を確認して、そうでなければ一覧に戻す。
  useEffect(() => {
    if (isStaff) {
      setAuthorized(true);
      return;
    }
    (async () => {
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
  }, [isStaff, userId, params.id, router]);

  function startEdit() {
    if (!player) return;
    setSei(player.sei);
    setMei(player.mei);
    setSeiKana(player.sei_kana ?? "");
    setMeiKana(player.mei_kana ?? "");
    setGrade(player.grade ?? "");
    setNumber(player.number ?? "");
    setPositions(player.positions);
    setStatus(player.status);
    setBirthday(player.birthday ?? "");
    setDeleteConfirm(false);
    setEditing(true);
  }

  function togglePos(p: Position) {
    setPositions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function handleSave() {
    if (!player) return;
    if (!sei.trim() || !mei.trim()) {
      toast("氏名を入力してください");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("players")
      .update({
        sei: sei.trim(),
        mei: mei.trim(),
        sei_kana: seiKana.trim() || null,
        mei_kana: meiKana.trim() || null,
        grade: grade || null,
        number: number.trim() || null,
        positions,
        status,
        birthday: birthday || null,
      })
      .eq("id", player.id);
    setSaving(false);
    if (error) {
      toast(`更新に失敗しました: ${error.message}`);
      return;
    }
    toast("選手情報を更新しました");
    setEditing(false);
    load();
  }

  async function handleDelete() {
    if (!player) return;
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(false), 3000);
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("players").delete().eq("id", player.id);
    if (error) {
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    toast("選手を削除しました");
    router.push("/players");
  }

  return (
    <PageShell
      header={
        <AppHeader
          title={player ? playerFullName(player) : "選手"}
          variant="detail"
          backHref={player?.status === "OB・OG" ? "/players/obog" : "/players"}
        />
      }
    >
      {loading || !authorized ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : !player ? (
        <EmptyState>選手が見つかりません</EmptyState>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            {prevId ? (
              <Link
                href={`/players/${prevId}`}
                aria-label="前の選手"
                className="w-[30px] h-[30px] rounded-lg bg-white border border-line flex items-center justify-center text-base text-navy"
              >
                ‹
              </Link>
            ) : (
              <span className="w-[30px] h-[30px] rounded-lg bg-white border border-line flex items-center justify-center text-base text-line">
                ‹
              </span>
            )}
            {nextId ? (
              <Link
                href={`/players/${nextId}`}
                aria-label="次の選手"
                className="w-[30px] h-[30px] rounded-lg bg-white border border-line flex items-center justify-center text-base text-navy"
              >
                ›
              </Link>
            ) : (
              <span className="w-[30px] h-[30px] rounded-lg bg-white border border-line flex items-center justify-center text-base text-line">
                ›
              </span>
            )}
          </div>

          {editing ? (
        <>
          <SectionLabel>選手情報を編集</SectionLabel>
          <Card>
            <div className="flex gap-2">
              <div className="flex-1">
                <FieldLabel>氏</FieldLabel>
                <input className={inputClass()} value={sei} onChange={(e) => setSei(e.target.value)} />
              </div>
              <div className="flex-1">
                <FieldLabel>名</FieldLabel>
                <input className={inputClass()} value={mei} onChange={(e) => setMei(e.target.value)} />
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <div className="flex-1">
                <FieldLabel>氏(カナ)</FieldLabel>
                <input className={inputClass()} value={seiKana} onChange={(e) => setSeiKana(e.target.value)} />
              </div>
              <div className="flex-1">
                <FieldLabel>名(カナ)</FieldLabel>
                <input className={inputClass()} value={meiKana} onChange={(e) => setMeiKana(e.target.value)} />
              </div>
            </div>

            <div className="mt-3">
              <FieldLabel>学年</FieldLabel>
              {status === "OB・OG" ? (
                <input
                  type="number"
                  min={6}
                  className={inputClass()}
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                />
              ) : (
                <select className={inputClass()} value={grade} onChange={(e) => setGrade(e.target.value as Grade | "")}>
                  <option value="">選択してください</option>
                  {GRADES.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="mt-3">
              <FieldLabel>誕生日</FieldLabel>
              <BirthdaySelect value={birthday} onChange={setBirthday} />
            </div>

            <div className="mt-3">
              <FieldLabel>背番号(リバ)</FieldLabel>
              <input className={inputClass()} value={number} onChange={(e) => setNumber(e.target.value)} />
            </div>

            <div className="mt-3">
              <FieldLabel>ポジション(複数選択可)</FieldLabel>
              <div className="flex gap-1.5 flex-wrap">
                {positionOptions.map((p) => (
                  <SegButton
                    key={p}
                    variant="small"
                    active={positions.includes(p)}
                    onClick={() => togglePos(p)}
                    className="flex-none px-3.5"
                  >
                    {p}
                  </SegButton>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <FieldLabel>ステータス</FieldLabel>
              <select
                className={inputClass()}
                value={status}
                onChange={(e) => setStatus(e.target.value as PlayerStatus)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <SubmitButton onClick={handleSave} disabled={saving}>
              {saving ? "保存中…" : "保存する"}
            </SubmitButton>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="w-full mt-2.5 text-center py-2 rounded-[10px] font-bold text-[12.5px] border border-line bg-white text-ink-soft"
            >
              キャンセル
            </button>
          </Card>

          <div className="font-mono text-[11px] tracking-widest uppercase text-ink-soft mt-4 mb-2.5">削除</div>
          <Card>
            <button
              type="button"
              onClick={handleDelete}
              className="w-full text-center py-2 rounded-[10px] font-bold text-[12.5px] border bg-white"
              style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
            >
              {deleteConfirm ? "もう一度タップで削除確定" : "この選手を削除する"}
            </button>
          </Card>
        </>
      ) : (
        <>
          <SectionLabel>基本情報</SectionLabel>
          <Card>
            <div className="text-[13.5px] text-ink">
              {player.sei_kana ?? ""}
              {player.mei_kana ?? ""}
            </div>
            <div className="text-[13.5px] text-ink mt-1">
              背番号 {player.number ?? "-"} /{" "}
              {player.status === "OB・OG" ? obogCohortLabel(player.grade) : gradeLabel(player.grade)}
            </div>
            <div className="text-[13.5px] text-ink mt-1">
              {player.positions.length > 0 ? player.positions.join("・") : "ポジション未設定"}
            </div>
            <div className="text-[13.5px] text-ink mt-1">ステータス: {player.status}</div>
            {player.birthday && (
              <div className="text-[13.5px] text-ink mt-1">誕生日: {formatFullDateLabel(player.birthday)}</div>
            )}
          </Card>

          {isStaff && (
            <>
              <SectionLabel>メモ</SectionLabel>
              <Link href={`/players/${player.id}/notes`}>
                <Card className="cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-[13.5px]">
                      {noteCount > 0 ? `メモあり(${noteCount}件)` : "メモなし"}
                    </div>
                    <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
                  </div>
                </Card>
              </Link>
            </>
          )}

          <SectionLabel>スタッツ</SectionLabel>
          {hasKarte ? (
            <Link href={`/players/${player.id}/stats`}>
              <Card className="cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-[13.5px]">試合スタッツを見る</div>
                  <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
                </div>
              </Card>
            </Link>
          ) : (
            <LockedFeatureCard label="試合スタッツを見る" requiredPlan="フル" />
          )}

          <SectionLabel>身長・体重(週次)</SectionLabel>
          <Link href={`/players/${player.id}/growth`}>
            <Card className="cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="font-bold text-[13.5px]">記録を入力する・閲覧する</div>
                <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
              </div>
            </Card>
          </Link>

          {plan === "Max" && (
            <>
              <SectionLabel>スポーツテスト</SectionLabel>
              <Link href={`/players/${player.id}/sports-test`}>
                <Card className="cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-[13.5px]">記録を入力する・閲覧する</div>
                    <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
                  </div>
                </Card>
              </Link>
            </>
          )}

          {isStaff && <SubmitButton onClick={startEdit}>編集する</SubmitButton>}
        </>
      )}
        </>
      )}
    </PageShell>
  );
}
