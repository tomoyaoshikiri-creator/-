"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { Card, SectionLabel } from "@/components/ui/Card";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { canManagePracticeMenus } from "@/lib/permissions";
import type { PracticeMenu } from "@/lib/database.types";

export function PracticeMenuCard({ scheduleId }: { scheduleId: string }) {
  const { teamId, userId, role } = useSession();
  const toast = useToast();
  const canManage = canManagePracticeMenus(role);

  const [menus, setMenus] = useState<PracticeMenu[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("practice_menus")
      .select("*")
      .eq("schedule_id", scheduleId)
      .order("updated_at", { ascending: true });
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
    const { error } = await supabase.from("practice_menus").insert({
      team_id: teamId,
      schedule_id: scheduleId,
      theme: trimmed,
      created_by: userId,
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

  if (loading) return null;
  if (!canManage && menus.length === 0) return null;

  return (
    <>
      <SectionLabel>実施メニュー</SectionLabel>
      {menus.map((m, idx) => (
        <Card
          key={m.id}
          className={canManage ? "cursor-pointer" : ""}
          onClick={canManage ? () => setExpandedId(expandedId === m.id ? null : m.id) : undefined}
        >
          {editingId === m.id ? (
            <div onClick={(e) => e.stopPropagation()}>
              <input value={editValue} onChange={(e) => setEditValue(e.target.value)} className={inputClass()} />
              <div className="flex gap-2 mt-2">
                <SubmitButton onClick={() => handleEditSave(m.id)} disabled={savingEdit} className="flex-1">
                  {savingEdit ? "保存中…" : "保存する"}
                </SubmitButton>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="flex-1 px-3 py-2 rounded-[10px] text-[12.5px] font-bold border border-line bg-paper text-ink-soft"
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <span className="font-mono text-ink-soft text-[12px] flex-shrink-0">{idx + 1}</span>
              <div className="flex-1 text-[13.5px] font-bold">{m.theme}</div>
            </div>
          )}
          {canManage && expandedId === m.id && editingId !== m.id && (
            <div className="flex gap-2 mt-2.5" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => {
                  setEditingId(m.id);
                  setEditValue(m.theme ?? "");
                }}
                className="flex-1 px-3 py-1.5 rounded-[8px] text-[11.5px] font-bold border border-line bg-paper text-ink-soft"
              >
                編集
              </button>
              <button
                type="button"
                onClick={() => handleDelete(m.id)}
                className={`flex-1 px-3 py-1.5 rounded-[8px] text-[11.5px] font-bold border ${
                  deleteConfirmId === m.id
                    ? "border-danger text-danger bg-danger/8"
                    : "border-line text-ink-soft bg-paper"
                }`}
              >
                {deleteConfirmId === m.id ? "もう一度タップで削除" : "削除"}
              </button>
            </div>
          )}
        </Card>
      ))}
      {canManage && (
        <Card>
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
        </Card>
      )}
    </>
  );
}
