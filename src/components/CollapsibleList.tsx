import type { ReactNode } from "react";

// タブを開いた直後は先頭5件だけを表示し、それ以上はボタンで折りたたんでおく。
// お知らせ・日報・コーチノートなど、月で絞り込んだ一覧でも1か月にたくさん投稿があるケースの対策。
export function CollapsibleList<T>({
  items,
  limit = 5,
  showAll,
  onShowAll,
  renderItem,
}: {
  items: T[];
  limit?: number;
  showAll: boolean;
  onShowAll: () => void;
  renderItem: (item: T) => ReactNode;
}) {
  const visibleItems = showAll ? items : items.slice(0, limit);
  const remaining = items.length - visibleItems.length;
  return (
    <>
      {visibleItems.map(renderItem)}
      {remaining > 0 && (
        <button
          type="button"
          onClick={onShowAll}
          className="block w-full mt-1 mb-2.5 text-center py-2 rounded-lg font-bold text-[12px] border border-line text-ink-soft bg-paper"
        >
          もっと見る(残り{remaining}件)
        </button>
      )}
    </>
  );
}
