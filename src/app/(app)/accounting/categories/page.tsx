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
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { FieldLabel, inputClass } from "@/components/ui/SegButton";
import { DragHandleIcon } from "@/components/icons";
import { canManageAccounting } from "@/lib/permissions";
import { hasAccountingAccess } from "@/lib/plan";
import { ACCOUNTING_CATEGORY_TEMPLATE, ACCOUNTING_KIND_LABELS, type AccountingKind } from "@/lib/accounting";
import type { AccountingCategory } from "@/lib/database.types";

function SortableCategoryRow({
  category,
  idx,
  deleteConfirmId,
  handleDelete,
}: {
  category: AccountingCategory;
  idx: number;
  deleteConfirmId: string | null;
  handleDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 border-b border-line last:border-b-0 py-2">
      <span className="font-mono text-ink-soft text-[12px] flex-shrink-0">{idx + 1}</span>
      <div className="flex-1 text-[13.5px] font-bold">{category.name}</div>
      <button
        type="button"
        onClick={() => handleDelete(category.id)}
        className={`flex-none px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
          deleteConfirmId === category.id ? "border-danger text-danger-text bg-danger/8" : "border-line text-ink-soft bg-paper"
        }`}
      >
        {deleteConfirmId === category.id ? "削除確定" : "削除"}
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

function CategorySection({
  kind,
  categories,
  teamId,
  onChanged,
}: {
  kind: AccountingKind;
  categories: AccountingCategory[];
  teamId: string;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const list = categories.filter((c) => c.kind === kind && !c.auto_managed);
  const templateNames = ACCOUNTING_CATEGORY_TEMPLATE[kind];
  const missingTemplateNames = templateNames.filter((name) => !list.some((c) => c.name === name));

  async function handleAdd() {
    const trimmed = input.trim();
    if (!trimmed) return;
    setSaving(true);
    const supabase = createClient();
    const nextPosition = list.length > 0 ? Math.max(...list.map((c) => c.position)) + 1 : 0;
    const { error } = await supabase.from("accounting_categories").insert({ team_id: teamId, kind, name: trimmed, position: nextPosition });
    setSaving(false);
    if (error) {
      toast.error(`保存に失敗しました: ${error.message}`);
      return;
    }
    setInput("");
    onChanged();
  }

  async function handleAddTemplate() {
    if (missingTemplateNames.length === 0) return;
    setSaving(true);
    const supabase = createClient();
    let nextPosition = list.length > 0 ? Math.max(...list.map((c) => c.position)) + 1 : 0;
    const rows = missingTemplateNames.map((name) => ({ team_id: teamId, kind, name, position: nextPosition++ }));
    const { error } = await supabase.from("accounting_categories").insert(rows);
    setSaving(false);
    if (error) {
      toast.error(`テンプレートの追加に失敗しました: ${error.message}`);
      return;
    }
    onChanged();
  }

  function handleDelete(id: string) {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      setTimeout(() => setDeleteConfirmId((cur) => (cur === id ? null : cur)), 3000);
      return;
    }
    setDeleteConfirmId(null);
    (async () => {
      const supabase = createClient();
      const { error } = await supabase.from("accounting_categories").delete().eq("id", id);
      if (error) {
        toast.error(`削除に失敗しました: ${error.message}`);
        return;
      }
      onChanged();
    })();
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = list.findIndex((c) => c.id === active.id);
    const newIndex = list.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(list, oldIndex, newIndex);
    const supabase = createClient();
    const results = await Promise.all(
      reordered.map((c, idx) => supabase.from("accounting_categories").update({ position: idx }).eq("id", c.id)),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      toast.error(`並び替えに失敗しました: ${failed.error.message}`);
    }
    onChanged();
  }

  return (
    <>
      <SectionLabel>{ACCOUNTING_KIND_LABELS[kind]}の項目</SectionLabel>
      <Card>
        {list.length === 0 ? (
          <EmptyState>まだ項目がありません</EmptyState>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={list.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              {list.map((c, idx) => (
                <SortableCategoryRow key={c.id} category={c} idx={idx} deleteConfirmId={deleteConfirmId} handleDelete={handleDelete} />
              ))}
            </SortableContext>
          </DndContext>
        )}
        <div className={list.length > 0 ? "mt-2.5" : ""}>
          <FieldLabel>項目名</FieldLabel>
          <div className="flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} className={inputClass()} placeholder="例: 部費" />
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving || !input.trim()}
              className="flex-none px-3.5 rounded-lg font-bold text-[12.5px] border border-orange text-orange-text bg-orange/8 disabled:opacity-50"
            >
              追加
            </button>
          </div>
          {missingTemplateNames.length > 0 && (
            <button
              type="button"
              onClick={handleAddTemplate}
              disabled={saving}
              className="w-full mt-2.5 text-center py-2 rounded-lg font-bold text-[12px] border border-line bg-paper text-ink-soft disabled:opacity-50"
            >
              テンプレートから追加({missingTemplateNames.length}件)
            </button>
          )}
        </div>
      </Card>
    </>
  );
}

export default function AccountingCategoriesPage() {
  const router = useRouter();
  const { role, plan, teamId } = useSession();

  useEffect(() => {
    if (!canManageAccounting(role) || !hasAccountingAccess(plan)) router.replace("/accounting");
  }, [role, plan, router]);

  const [categories, setCategories] = useState<AccountingCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("accounting_categories").select("*").order("position", { ascending: true });
    setCategories(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PageShell header={<AppHeader title="項目の管理" variant="detail" backHref="/accounting" accessBadge="operations" />}>
      <div className="text-[12px] text-ink-soft mb-3">
        予算・入出金・会計報告で使う収入・支出の項目です。チームで自由に追加・並び替えできます。
      </div>
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : (
        <>
          <CategorySection kind="income" categories={categories} teamId={teamId} onChanged={load} />
          <CategorySection kind="expense" categories={categories} teamId={teamId} onChanged={load} />
        </>
      )}
    </PageShell>
  );
}
