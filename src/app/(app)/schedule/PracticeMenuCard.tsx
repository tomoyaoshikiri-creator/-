"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { cardClass, SectionLabel } from "@/components/ui/Card";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { EditButton } from "@/components/ui/EditButton";
import { ChevronRightIcon, CloseIcon, CopyIcon, DragHandleIcon } from "@/components/icons";
import { useUnsavedChangesGuard } from "@/lib/navigationGuard";
import { canManagePracticeMenus } from "@/lib/permissions";
import { hasPracticeMenuAccess } from "@/lib/plan";
import { LockedFeatureCard } from "@/components/PlanLock";
import { formatDateLabel } from "@/lib/format";
import type { PracticeMenu } from "@/lib/database.types";

interface CopyTarget {
  id: string;
  date: string;
  title: string;
}

// 編集モード中だけ存在する作業用の行データ。既存DB行はisNew:false・idはそのままのUUID、
// 新規追加した未保存行はisNew:true・idは一時的なローカル文字列(保存時にinsertへ変換)。
interface DraftMenu {
  id: string;
  theme: string;
  isNew: boolean;
}

export function PracticeMenuCard({ scheduleId, scheduleDate }: { scheduleId: string; scheduleDate: string }) {
  const { teamId, userId, role, plan } = useSession();
  const toast = useToast();
  const canManage = canManagePracticeMenus(role);
  const hasAccess = hasPracticeMenuAccess(plan);

  const [menus, setMenus] = useState<PracticeMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DraftMenu[]>([]);
  const [savingAll, setSavingAll] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyTargets, setCopyTargets] = useState<CopyTarget[]>([]);
  const [copyTargetId, setCopyTargetId] = useState("");
  const [copying, setCopying] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // 編集モード中(保存/キャンセルで確定するまでDBに反映されない)は、離脱確認で保護する。
  useUnsavedChangesGuard(editing);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("practice_menus")
      .select("*")
      .eq("schedule_id", scheduleId)
      .order("position", { ascending: true });
    setMenus(data ?? []);
    setLoading(false);
  }, [scheduleId]);

  useEffect(() => {
    load();
  }, [load]);

  function handleStartEdit() {
    setDraft(menus.map((m) => ({ id: m.id, theme: m.theme ?? "", isNew: false })));
    setSaveError(null);
    setEditing(true);
  }

  function handleCancelEdit() {
    setEditing(false);
    setDraft([]);
    setSaveError(null);
    setCopyOpen(false);
    setCopyTargetId("");
  }

  function handleAddRow() {
    setDraft((cur) => [...cur, { id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`, theme: "", isNew: true }]);
  }

  function handleRemoveRow(id: string) {
    setDraft((cur) => cur.filter((d) => d.id !== id));
  }

  function handleDraftThemeChange(id: string, value: string) {
    setDraft((cur) => cur.map((d) => (d.id === id ? { ...d, theme: value } : d)));
  }

  function handleDraftDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = draft.findIndex((d) => d.id === active.id);
    const newIndex = draft.findIndex((d) => d.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    setDraft((cur) => arrayMove(cur, oldIndex, newIndex));
  }

  // 追加・変更・削除・並び替えをまとめて1回で反映する(「保存」でまとめて保存)。
  // 失敗した場合は編集内容(draft)をそのまま維持し、エラーだけ表示する。
  async function handleSaveAll() {
    setSavingAll(true);
    setSaveError(null);
    const supabase = createClient();
    const finalDraft = draft.filter((d) => d.theme.trim() !== "");
    const keptIds = new Set(finalDraft.filter((d) => !d.isNew).map((d) => d.id));
    const deletedIds = menus.filter((m) => !keptIds.has(m.id)).map((m) => m.id);

    const ops = [
      ...deletedIds.map((id) => supabase.from("practice_menus").delete().eq("id", id)),
      ...finalDraft.map((d, idx) =>
        d.isNew
          ? supabase.from("practice_menus").insert({
              team_id: teamId,
              schedule_id: scheduleId,
              theme: d.theme.trim(),
              created_by: userId,
              position: idx,
            })
          : supabase.from("practice_menus").update({ theme: d.theme.trim(), position: idx }).eq("id", d.id),
      ),
    ];
    const results = await Promise.all(ops);
    setSavingAll(false);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      setSaveError(`保存に失敗しました: ${failed.error.message}`);
      return;
    }
    setEditing(false);
    setDraft([]);
    setCopyOpen(false);
    setCopyTargetId("");
    load();
  }

  async function openCopy() {
    setCopyOpen(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("schedules")
      .select("id, date, title")
      .eq("type", "practice")
      .neq("id", scheduleId)
      .order("date", { ascending: false })
      .limit(50);
    const targets = data ?? [];
    setCopyTargets(targets);
    // デフォルトはコピー元より後で一番近い練習日(次回の練習)。無ければ未選択のまま。
    const next = targets.filter((t) => t.date > scheduleDate).sort((a, b) => a.date.localeCompare(b.date))[0];
    setCopyTargetId(next?.id ?? "");
  }

  async function handleCopy() {
    if (!copyTargetId) return;
    setCopying(true);
    const supabase = createClient();
    const { error } = await supabase.from("practice_menus").insert(
      menus.map((m, idx) => ({
        team_id: teamId,
        schedule_id: copyTargetId,
        theme: m.theme,
        created_by: userId,
        position: idx,
      })),
    );
    setCopying(false);
    if (error) {
      toast.error(`コピーに失敗しました: ${error.message}`);
      return;
    }
    toast.success("コピーしました");
    setCopyOpen(false);
    setCopyTargetId("");
  }

  if (loading) return null;
  if (!canManage && menus.length === 0) return null;
  if (canManage && !hasAccess && menus.length === 0) {
    return <LockedFeatureCard label="実施メニュー" description="練習メニューを記録する" requiredPlan="中間" />;
  }

  return (
    <>
      {/* 共通EditButton(src/components/ui/EditButton.tsx)に置き換え。見出し行自体も
          SectionLabelへ統一し、手書きの見出し+罫線+操作ボタンの重複実装を無くした。
          編集開始の処理(handleStartEdit)自体は変更していない。 */}
      <SectionLabel
        action={
          canManage && hasAccess && !editing && (
            <EditButton onClick={handleStartEdit} ariaLabel="実施メニューを編集" />
          )
        }
      >
        実施メニュー
      </SectionLabel>
      <div className={cardClass}>
        {!editing ? (
          menus.length === 0 ? (
            <div className="text-xs text-ink-soft text-center py-1">まだメニューがありません</div>
          ) : (
            menus.map((m, idx) => (
              <div key={m.id} className="flex items-start gap-2 py-1 border-b border-line last:border-b-0">
                <span className="font-mono text-ink-soft text-[11px] flex-shrink-0 pt-[3px] w-4 text-right">
                  {idx + 1}
                </span>
                <div className="flex-1 text-[12.5px] font-bold break-words leading-snug py-[3px]">{m.theme}</div>
              </div>
            ))
          )
        ) : (
          <>
            {saveError && <div className="text-xs font-bold text-danger-text mb-2.5">{saveError}</div>}
            {draft.length === 0 ? (
              <div className="text-xs text-ink-soft text-center py-1 mb-2">まだメニューがありません</div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDraftDragEnd}>
                <SortableContext items={draft.map((d) => d.id)} strategy={verticalListSortingStrategy}>
                  {draft.map((d, idx) => (
                    <DraftMenuRow
                      key={d.id}
                      item={d}
                      idx={idx}
                      onChangeTheme={(v) => handleDraftThemeChange(d.id, v)}
                      onRemove={() => handleRemoveRow(d.id)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
            <button
              type="button"
              onClick={handleAddRow}
              className="w-full min-h-tap flex items-center justify-center rounded-control border border-dashed border-line text-xs font-bold text-ink-soft mt-1 mb-3"
            >
              + メニューを追加
            </button>

            {menus.length > 0 && !copyOpen && (
              // 確定デザイン: 高さ40px・編集エリア全幅・白背景・薄いグレーの枠線・角丸、
              // 左にコピーアイコン・中央にラベル・右に右矢印。保存(オレンジ系の塗り)・
              // キャンセル(bg-paperの枠線ボタン)より控えめに見えるよう、無地の白背景+
              // 細い枠線のみにし、文字色も控えめなink-softにしている(以前のtext-orange-text
              // font-boldより目立たない見た目)。コピー処理・コピー先選択・保存処理自体は
              // 変更していない(onClick=openCopyのまま)。
              <button
                type="button"
                onClick={openCopy}
                className="w-full h-10 flex items-center gap-2 px-3 rounded-control border border-line bg-white text-[12px] font-bold text-ink-soft mb-3"
              >
                <CopyIcon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-center">他の練習日にコピー</span>
                <ChevronRightIcon className="w-4 h-4 flex-shrink-0" />
              </button>
            )}
            {copyOpen && (
              <div className="border-t border-line pt-2.5 mb-3">
                <FieldLabel>コピー先の練習を選ぶ</FieldLabel>
                <select className={inputClass()} value={copyTargetId} onChange={(e) => setCopyTargetId(e.target.value)}>
                  <option value="">選択してください</option>
                  {copyTargets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {formatDateLabel(s.date)} {s.title}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2 mt-2">
                  {/* 高さ調整: 画面内の主要操作ボタン(予定を編集・コピーして登録・保存・
                      キャンセル)をmin-h-tap(44px)で統一する。コピー先選択後の実行ボタン
                      (コピーする/キャンセル)も同じ主要操作の一種として揃える。「他の練習日に
                      コピー」(トリガー、40px固定)とは別物なので対象外。コピー処理自体は
                      変更していない。 */}
                  <SubmitButton
                    onClick={handleCopy}
                    disabled={copying || !copyTargetId}
                    className="!mt-0 flex-1 min-h-tap flex items-center justify-center"
                  >
                    {copying ? "コピー中…" : "コピーする"}
                  </SubmitButton>
                  <button
                    type="button"
                    onClick={() => {
                      setCopyOpen(false);
                      setCopyTargetId("");
                    }}
                    className="flex-1 min-h-tap flex items-center justify-center rounded-lg text-[13px] font-bold border border-line bg-paper text-ink-soft"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {/* 高さ調整: 保存・キャンセルをmin-h-tap(44px)で統一(以前はpy-2.5のみで
                  min-h-tapが無く、他の主要操作ボタンより低かった)。保存処理・キャンセル
                  処理自体は変更していない。 */}
              <SubmitButton
                onClick={handleSaveAll}
                disabled={savingAll}
                className="!mt-0 flex-1 min-h-tap flex items-center justify-center"
              >
                {savingAll ? "保存中…" : "保存"}
              </SubmitButton>
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={savingAll}
                className="flex-1 min-h-tap flex items-center justify-center rounded-lg text-[13px] font-bold border border-line bg-paper text-ink-soft"
              >
                キャンセル
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function DraftMenuRow({
  item,
  idx,
  onChangeTheme,
  onRemove,
}: {
  item: DraftMenu;
  idx: number;
  onChangeTheme: (value: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-1.5 border-b border-line pb-2 mb-2 last:border-b-0 last:mb-0 last:pb-0"
    >
      <span className="font-mono text-ink-soft text-[11px] flex-shrink-0 w-4 text-right">{idx + 1}</span>
      <input
        value={item.theme}
        onChange={(e) => onChangeTheme(e.target.value)}
        className={inputClass("flex-1")}
        placeholder="例: シュート強化"
      />
      <button
        type="button"
        onClick={onRemove}
        className="w-7 h-7 flex items-center justify-center text-ink-soft flex-shrink-0"
        aria-label="この行を削除"
      >
        <CloseIcon className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="w-7 h-7 flex items-center justify-center text-ink-soft flex-shrink-0 cursor-grab active:cursor-grabbing"
        style={{ touchAction: "none" }}
        aria-label="ドラッグして並び替え"
      >
        <DragHandleIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
