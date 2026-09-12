"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { inputClass } from "@/components/ui/SegButton";
import type { LibraryCategory } from "@/lib/database.types";

// カテゴリー名のリネームのみを行う(追加は資料追加時のフローに、削除は今回は対象外)。
// カテゴリー自体は特定の資料の所有物ではなくチーム共有のタグのため、呼び出し元
// (library/page.tsx)でスタッフ(指導者・管理者)のみに開くボタンを出している。
export function EditCategoriesModal({
  open,
  categories,
  onClose,
  onUpdated,
}: {
  open: boolean;
  categories: LibraryCategory[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const toast = useToast();
  const [names, setNames] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const map: Record<string, string> = {};
    categories.forEach((c) => {
      map[c.id] = c.name;
    });
    setNames(map);
  }, [open, categories]);

  async function handleSave(category: LibraryCategory) {
    const name = (names[category.id] ?? "").trim();
    if (!name) {
      toast("カテゴリー名を入力してください");
      return;
    }
    if (name === category.name) return;
    setSavingId(category.id);
    const supabase = createClient();
    const { error } = await supabase.from("library_categories").update({ name }).eq("id", category.id);
    setSavingId(null);
    if (error) {
      toast(`更新に失敗しました: ${error.message}`);
      return;
    }
    toast("カテゴリー名を更新しました");
    onUpdated();
  }

  return (
    <Modal open={open} onClose={onClose} title="カテゴリーを編集">
      {categories.length === 0 ? (
        <div className="text-[12.5px] text-ink-soft">カテゴリーがありません</div>
      ) : (
        <div className="space-y-2.5">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <input
                className={inputClass("flex-1")}
                value={names[c.id] ?? ""}
                onChange={(e) => setNames((prev) => ({ ...prev, [c.id]: e.target.value }))}
              />
              <button
                type="button"
                onClick={() => handleSave(c)}
                disabled={savingId === c.id || (names[c.id] ?? "").trim() === c.name}
                className="flex-none text-[12px] font-bold text-orange border border-orange rounded-lg px-3 py-2 bg-orange/8 disabled:opacity-40"
              >
                {savingId === c.id ? "保存中…" : "保存"}
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
