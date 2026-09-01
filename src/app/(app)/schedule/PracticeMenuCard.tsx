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
import { Card } from "@/components/ui/Card";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { DragHandleIcon } from "@/components/icons";
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

export function PracticeMenuCard({ scheduleId }: { scheduleId: string }) {
  const { teamId, userId, role, plan } = useSession();
  const toast = useToast();
  const canManage = canManagePracticeMenus(role);
  const hasAccess = hasPracticeMenuAccess(plan);

  const [menus, setMenus] = useState<PracticeMenu[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyTargets, setCopyTargets] = useState<CopyTarget[]>([]);
  const [copyTargetId, setCopyTargetId] = useState("");
  const [copying, setCopying] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useUnsavedChangesGuard(input.trim() !== "");
  const editingMenu = menus.find((m) => m.id === editingId);
  useUnsavedChangesGuard(editingMenu !== undefined && editValue !== (editingMenu.theme ?? ""));

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

  async function handleAdd() {
    const trimmed = input.trim();
    if (!trimmed) return;
    setSaving(true);
    const supabase = createClient();
    const nextPosition = menus.length > 0 ? Math.max(...menus.map((m) => m.position)) + 1 : 0;
    const { error } = await supabase.from("practice_menus").insert({
      team_id: teamId,
      schedule_id: scheduleId,
      theme: trimmed,
      created_by: userId,
      position: nextPosition,
    });
    setSaving(false);
    if (error) {
      toast(`保存に失敗しました: ${error.message}`);
      return;
    }
    setInput("");
    load();
  }

  async function handleEditSave(id: string) {
    const trimmed = editValue.trim();
    if (!trimmed) return;
    setSavingEdit(true);
    const supabase = createClient();
    const { error } = await supabase.from("practice_menus").update({ theme: trimmed }).eq("id", id);
    setSavingEdit(false);
    if (error) {
      toast(`更新に失敗しました: ${error.message}`);
      return;
    }
    setEditingId(null);
    load();
  }

  async function handleDelete(id: string) {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      setTimeout(() => setDeleteConfirmId((cur) => (cur === id ? null : cur)), 3000);
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("practice_menus").delete().eq("id", id);
    if (error) {
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    setDeleteConfirmId(null);
    setExpandedId(null);
    load();
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = menus.findIndex((m) => m.id === active.id);
    const newIndex = menus.findIndex((m) => m.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(menus, oldIndex, newIndex);
    setMenus(reordered);
    const supabase = createClient();
    const results = await Promise.all(
      reordered.map((m, idx) => supabase.from("practice_menus").update({ position: idx }).eq("id", m.id)),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      toast(`並び替えに失敗しました: ${failed.error.message}`);
      load();
    }
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
    setCopyTargets(data ?? []);
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
      toast(`コピーに失敗しました: ${error.message}`);
      return;
    }
    toast("コピーしました");
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
      <div className="mb-2.5 flex items-center gap-2">
        <span className="font-mono text-[13px] font-bold tracking-widest uppercase text-ink whitespace-nowrap">
          実施メニュー
        </span>
        <span className="flex-1 h-px bg-line" />
        {canManage && menus.length > 0 && !copyOpen && (
          <button type="button" onClick={openCopy} className="text-[12px] font-bold text-orange whitespace-nowrap">
            他の練習日にコピー
          </button>
        )}
      </div>
      <Card>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={menus.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            {menus.map((m, idx) => (
              <SortableMenuRow
                key={m.id}
                menu={m}
                idx={idx}
                canManage={canManage}
                editingId={editingId}
                editValue={editValue}
                setEditValue={setEditValue}
                savingEdit={savingEdit}
                handleEditSave={handleEditSave}
                setEditingId={setEditingId}
                expandedId={expandedId}
                setExpandedId={setExpandedId}
                deleteConfirmId={deleteConfirmId}
                handleDelete={handleDelete}
              />
            ))}
          </SortableContext>
        </DndContext>
        {canManage && menus.length > 0 && copyOpen && (
          <div className="border-b border-line pb-2.5 mb-2.5">
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
              <SubmitButton onClick={handleCopy} disabled={copying || !copyTargetId} className="!mt-0 flex-1">
                {copying ? "コピー中…" : "コピーする"}
              </SubmitButton>
              <button
                type="button"
                onClick={() => {
                  setCopyOpen(false);
                  setCopyTargetId("");
                }}
                className="flex-1 py-2.5 rounded-[10px] text-[13px] font-bold border border-line bg-paper text-ink-soft"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
        {canManage && hasAccess && (
          <div>
            <FieldLabel>入力欄</FieldLabel>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className={inputClass()}
              placeholder="例: シュート強化"
            />
            <SubmitButton onClick={handleAdd} disabled={saving || !input.trim()}>
              {saving ? "保存中…" : "保存する"}
            </SubmitButton>
          </div>
        )}
      </Card>
    </>
  );
}

function SortableMenuRow({
  menu,
  idx,
  canManage,
  editingId,
  editValue,
  setEditValue,
  savingEdit,
  handleEditSave,
  setEditingId,
  expandedId,
  setExpandedId,
  deleteConfirmId,
  handleDelete,
}: {
  menu: PracticeMenu;
  idx: number;
  canManage: boolean;
  editingId: string | null;
  editValue: string;
  setEditValue: (v: string) => void;
  savingEdit: boolean;
  handleEditSave: (id: string) => void;
  setEditingId: (id: string | null) => void;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  deleteConfirmId: string | null;
  handleDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: menu.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border-b border-line pb-2.5 mb-2.5 last:border-b-0 last:mb-0 last:pb-0"
    >
      {editingId === menu.id ? (
        <div>
          <input value={editValue} onChange={(e) => setEditValue(e.target.value)} className={inputClass()} />
          <div className="flex gap-2 mt-2">
            <SubmitButton onClick={() => handleEditSave(menu.id)} disabled={savingEdit} className="!mt-0 flex-1">
              {savingEdit ? "保存中…" : "保存する"}
            </SubmitButton>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="flex-1 py-2.5 rounded-[10px] text-[13px] font-bold border border-line bg-paper text-ink-soft"
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <div
          className={canManage ? "cursor-pointer" : ""}
          onClick={canManage ? () => setExpandedId(expandedId === menu.id ? null : menu.id) : undefined}
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-ink-soft text-[12px] flex-shrink-0">{idx + 1}</span>
            <div className="flex-1 text-[13.5px] font-bold">{menu.theme}</div>
            {canManage && (
              <button
                type="button"
                {...attributes}
                {...listeners}
                onClick={(e) => e.stopPropagation()}
                className="w-7 h-7 flex items-center justify-center text-ink-soft flex-shrink-0 cursor-grab active:cursor-grabbing"
                style={{ touchAction: "none" }}
                aria-label="ドラッグして並び替え"
              >
                <DragHandleIcon className="w-4 h-4" />
              </button>
            )}
          </div>
          {canManage && expandedId === menu.id && (
            <div className="flex gap-2 mt-2.5" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => {
                  setEditingId(menu.id);
                  setEditValue(menu.theme ?? "");
                }}
                className="flex-1 px-3 py-1.5 rounded-[8px] text-[11.5px] font-bold border border-line bg-paper text-ink-soft"
              >
                編集
              </button>
              <button
                type="button"
                onClick={() => handleDelete(menu.id)}
                className={`flex-1 px-3 py-1.5 rounded-[8px] text-[11.5px] font-bold border ${
                  deleteConfirmId === menu.id
                    ? "border-danger text-danger bg-danger/8"
                    : "border-line text-ink-soft bg-paper"
                }`}
              >
                {deleteConfirmId === menu.id ? "もう一度タップで削除" : "削除"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
