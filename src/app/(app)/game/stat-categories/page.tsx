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

type EvaluationDirection = "" | "HIGHER_IS_BETTER" | "LOWER_IS_BETTER" | "NEUTRAL";

const DIRECTION_LABELS: Record<EvaluationDirection, string> = {
  "": "未設定",
  HIGHER_IS_BETTER: "数値が高いほど良い",
  LOWER_IS_BETTER: "数値が低いほど良い",
  NEUTRAL: "単純な高低で評価しない",
};

type AggregationType = "" | "SUM" | "AVERAGE" | "RATE" | "NEUTRAL";

const AGGREGATION_LABELS: Record<AggregationType, string> = {
  "": "集計方法を指定しない",
  SUM: "合計",
  AVERAGE: "平均",
  RATE: "割合・率",
  NEUTRAL: "合計・平均どちらの意味も持たない",
};

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
  const [newDirection, setNewDirection] = useState<EvaluationDirection>("");
  const [newAggregation, setNewAggregation] = useState<AggregationType>("");
  const [newUnit, setNewUnit] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editDirection, setEditDirection] = useState<EvaluationDirection>("");
  const [editAggregation, setEditAggregation] = useState<AggregationType>("");
  const [editUnit, setEditUnit] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useUnsavedChangesGuard(
    input.trim() !== "" ||
      newUnit.trim() !== "" ||
      newDescription.trim() !== "" ||
      newDirection !== "" ||
      newAggregation !== "",
  );
  const editingCategory = categories.find((c) => c.id === editingId);
  useUnsavedChangesGuard(
    editingCategory !== undefined &&
      (editValue !== editingCategory.name ||
        editDirection !== (editingCategory.evaluation_direction ?? "") ||
        editAggregation !== (editingCategory.aggregation_type ?? "") ||
        editUnit !== (editingCategory.unit ?? "") ||
        editDescription !== (editingCategory.description ?? "")),
  );

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
      evaluation_direction: newDirection || null,
      aggregation_type: newAggregation || null,
      unit: newUnit.trim() || null,
      description: newDescription.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast(`保存に失敗しました: ${error.message}`);
      return;
    }
    setInput("");
    setNewDirection("");
    setNewAggregation("");
    setNewUnit("");
    setNewDescription("");
    load();
  }

  function startEdit(category: TeamStatCategory) {
    setEditingId(category.id);
    setEditValue(category.name);
    setEditDirection((category.evaluation_direction ?? "") as EvaluationDirection);
    setEditAggregation((category.aggregation_type ?? "") as AggregationType);
    setEditUnit(category.unit ?? "");
    setEditDescription(category.description ?? "");
  }

  async function handleEditSave(id: string) {
    const trimmed = editValue.trim();
    if (!trimmed) return;
    setSavingEdit(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("team_stat_categories")
      .update({
        name: trimmed,
        evaluation_direction: editDirection || null,
        aggregation_type: editAggregation || null,
        unit: editUnit.trim() || null,
        description: editDescription.trim() || null,
      })
      .eq("id", id);
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
        試合スタッツ入力画面(選手×項目の表)に表示する項目です。チームで自由に追加・並び替えできます。単位・説明・評価方向はAI分析でも参照されます。
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
                    editDirection={editDirection}
                    setEditDirection={setEditDirection}
                    editAggregation={editAggregation}
                    setEditAggregation={setEditAggregation}
                    editUnit={editUnit}
                    setEditUnit={setEditUnit}
                    editDescription={editDescription}
                    setEditDescription={setEditDescription}
                    savingEdit={savingEdit}
                    handleEditSave={handleEditSave}
                    startEdit={startEdit}
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
            <FieldLabel>項目名</FieldLabel>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className={inputClass()}
              placeholder="例: ゴール"
            />
            <div className="mt-2.5">
              <FieldLabel>評価方向(任意、AI分析で数値の良し悪しを判断する材料になります)</FieldLabel>
              <select
                className={inputClass()}
                value={newDirection}
                onChange={(e) => setNewDirection(e.target.value as EvaluationDirection)}
              >
                {(Object.keys(DIRECTION_LABELS) as EvaluationDirection[]).map((v) => (
                  <option key={v} value={v}>
                    {DIRECTION_LABELS[v]}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-2.5">
              <FieldLabel>チーム集計方法(任意、AI分析でこの数値の意味を判断する材料になります)</FieldLabel>
              <select
                className={inputClass()}
                value={newAggregation}
                onChange={(e) => setNewAggregation(e.target.value as AggregationType)}
              >
                {(Object.keys(AGGREGATION_LABELS) as AggregationType[]).map((v) => (
                  <option key={v} value={v}>
                    {AGGREGATION_LABELS[v]}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-2.5">
              <FieldLabel>単位(任意)</FieldLabel>
              <input
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                className={inputClass()}
                placeholder="例: %、回、本、点、m、秒"
              />
            </div>
            <div className="mt-2.5">
              <FieldLabel>説明(任意)</FieldLabel>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
                className={inputClass()}
                placeholder="例: 相手陣内でボールを奪った回数"
              />
            </div>
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
  editDirection,
  setEditDirection,
  editAggregation,
  setEditAggregation,
  editUnit,
  setEditUnit,
  editDescription,
  setEditDescription,
  savingEdit,
  handleEditSave,
  startEdit,
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
  editDirection: EvaluationDirection;
  setEditDirection: (v: EvaluationDirection) => void;
  editAggregation: AggregationType;
  setEditAggregation: (v: AggregationType) => void;
  editUnit: string;
  setEditUnit: (v: string) => void;
  editDescription: string;
  setEditDescription: (v: string) => void;
  savingEdit: boolean;
  handleEditSave: (id: string) => void;
  startEdit: (category: TeamStatCategory) => void;
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
  const metaLabel = [
    category.unit ? `単位: ${category.unit}` : null,
    category.evaluation_direction ? DIRECTION_LABELS[category.evaluation_direction] : null,
    category.aggregation_type ? AGGREGATION_LABELS[category.aggregation_type] : null,
  ]
    .filter(Boolean)
    .join(" / ");

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border-b border-line pb-2.5 mb-2.5 last:border-b-0 last:mb-0 last:pb-0"
    >
      {editingId === category.id ? (
        <div>
          <FieldLabel>項目名</FieldLabel>
          <input value={editValue} onChange={(e) => setEditValue(e.target.value)} className={inputClass()} />
          <div className="mt-2.5">
            <FieldLabel>評価方向(任意)</FieldLabel>
            <select
              className={inputClass()}
              value={editDirection}
              onChange={(e) => setEditDirection(e.target.value as EvaluationDirection)}
            >
              {(Object.keys(DIRECTION_LABELS) as EvaluationDirection[]).map((v) => (
                <option key={v} value={v}>
                  {DIRECTION_LABELS[v]}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-2.5">
            <FieldLabel>チーム集計方法(任意)</FieldLabel>
            <select
              className={inputClass()}
              value={editAggregation}
              onChange={(e) => setEditAggregation(e.target.value as AggregationType)}
            >
              {(Object.keys(AGGREGATION_LABELS) as AggregationType[]).map((v) => (
                <option key={v} value={v}>
                  {AGGREGATION_LABELS[v]}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-2.5">
            <FieldLabel>単位(任意)</FieldLabel>
            <input
              value={editUnit}
              onChange={(e) => setEditUnit(e.target.value)}
              className={inputClass()}
              placeholder="例: %、回、本、点、m、秒"
            />
          </div>
          <div className="mt-2.5">
            <FieldLabel>説明(任意)</FieldLabel>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={2}
              className={inputClass()}
              placeholder="例: 相手陣内でボールを奪った回数"
            />
          </div>
          <div className="flex gap-2 mt-2.5">
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
            <div className="flex-1">
              <div className="text-[13.5px] font-bold">{category.name}</div>
              {metaLabel && <div className="text-[10.5px] text-ink-soft mt-0.5">{metaLabel}</div>}
            </div>
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
                onClick={() => startEdit(category)}
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
