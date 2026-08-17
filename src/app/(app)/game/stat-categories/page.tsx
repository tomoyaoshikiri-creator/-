"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState } from "@/components/ui/Card";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { DragHandleIcon } from "@/components/icons";
import { useUnsavedChangesGuard } from "@/lib/navigationGuard";
import { canManageStatCategories } from "@/lib/permissions";
import { usesDetailedBasketballStats } from "@/lib/sport";
import type { TeamStatCategory } from "@/lib/database.types";

export default function StatCategoriesPage() {
  const router = useRouter();
  const { teamId, role, sport } = useSession();
  const toast = useToast();
  const canManage = canManageStatCategories(role);

  useEffect(() => {
    if (usesDetailedBasketballStats(sport) || !canManage) router.replace("/game");
  }, [sport, canManage, router]);

  const [categories, setCategories] = useState<TeamStatCategory[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useUnsavedChangesGuard(input.trim() !== "");
  const editingCategory = categories.find((c) => c.id === editingId);
  useUnsavedChangesGuard(editingCategory !== undefined && editValue !== editingCategory.name);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from("team_stat_categories").select("*").order("position", { ascending: true });
    setCategories(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd() {
    const trimmed = input.trim();
    if (!trimmed) return;
    setSaving(true);
    const supabase = createClient();
    const nextPosition = categories.length > 0 ? Math.max(...categories.map((c) => c.position)) + 1 : 0;
    const { error } = await supabase.from("team_stat_categories").insert({
      team_id: teamId,
      name: trimmed,
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
    const { error } = await supabase.from("team_stat_categories").update({ name: trimmed }).eq("id", id);
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
    const { error } = await supabase.from("team_stat_categories").delete().eq("id", id);
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
    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(categories, oldIndex, newIndex);
    setCategories(reordered);
    const supabase = createClient();
    const results = await Promise.all(
      reordered.map((c, idx) => supabase.from("team_stat_categories").update({ position: idx }).eq("id", c.id)),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      toast(`並び替えに失敗しました: ${failed.error.message}`);
      load();
    }
  }

  return (
    <PageShell header={<AppHeader title="スタッツ項目を編集" variant="detail" backHref="/game" accessBadge="coach" />}>
      <div className="text-[12px] text-ink-soft mb-3">
        試合スタッツ入力画面(選手×項目の表)に表示する項目です。チームで自由に追加・並び替えできます。
      </div>
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : (
        <Card>
          {categories.length === 0 ? (
            <EmptyState>まだ項目がありません</EmptyState>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                {categories.map((c, idx) => (
                  <SortableCategoryRow
                    key={c.id}
                    category={c}
                    idx={idx}
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
          )}
          <div className={categories.length > 0 ? "mt-2.5" : ""}>
            <FieldLabel>入力欄</FieldLabel>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className={inputClass()}
              placeholder="例: ゴール"
            />
            <SubmitButton onClick={handleAdd} disabled={saving || !input.trim()}>
              {saving ? "保存中…" : "保存する"}
            </SubmitButton>
          </div>
        </Card>
      )}
    </PageShell>
  );
}

function SortableCategoryRow({
  category,
  idx,
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
  category: TeamStatCategory;
  idx: number;
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });
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
      {editingId === category.id ? (
        <div>
          <input value={editValue} onChange={(e) => setEditValue(e.target.value)} className={inputClass()} />
          <div className="flex gap-2 mt-2">
            <SubmitButton onClick={() => handleEditSave(category.id)} disabled={savingEdit} className="flex-1 mt-0">
              {savingEdit ? "保存中…" : "保存する"}
            </SubmitButton>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="flex-1 px-3 py-2.5 rounded-[10px] text-[13px] font-bold border border-line bg-paper text-ink-soft"
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <div
          className="cursor-pointer"
          onClick={() => setExpandedId(expandedId === category.id ? null : category.id)}
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-ink-soft text-[12px] flex-shrink-0">{idx + 1}</span>
            <div className="flex-1 text-[13.5px] font-bold">{category.name}</div>
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
          </div>
          {expandedId === category.id && (
            <div className="flex gap-2 mt-2.5" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => {
                  setEditingId(category.id);
                  setEditValue(category.name);
                }}
                className="flex-1 px-3 py-1.5 rounded-[8px] text-[11.5px] font-bold border border-line bg-paper text-ink-soft"
              >
                編集
              </button>
              <button
                type="button"
                onClick={() => handleDelete(category.id)}
                className={`flex-1 px-3 py-1.5 rounded-[8px] text-[11.5px] font-bold border ${
                  deleteConfirmId === category.id
                    ? "border-danger text-danger bg-danger/8"
                    : "border-line text-ink-soft bg-paper"
                }`}
              >
                {deleteConfirmId === category.id ? "もう一度タップで削除" : "削除"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
