// 設定・登録系カードの「編集」⇄「完了」切り替えボタン。SectionLabelのaction枠に置く想定。
// 各カードは既存のフィールドごとの即時保存(onBlur/onChange)をそのまま使い、この
// ボタンは「編集可能な入力を表示するか、読み取り専用の表示にするか」だけを切り替える
// (値の確定を待つ下書き・キャンセルの仕組みは持たない)。
export function EditToggleButton({ editing, onClick }: { editing: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-none text-[11px] font-bold px-2.5 py-1 rounded-full border border-line text-ink-soft bg-paper"
    >
      {editing ? "完了" : "編集"}
    </button>
  );
}
