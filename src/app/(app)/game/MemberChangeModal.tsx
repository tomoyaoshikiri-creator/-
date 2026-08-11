"use client";

import { Modal } from "@/components/ui/Modal";

export interface MemberOption {
  id: string;
  label: string;
  checked: boolean;
}

// 試合中に発生する途中交代を、スタッツ入力画面からその場で反映するための選手選択モーダル。
// 出場中の選手をタップして選択解除→控えの選手をタップして選択、で交代を表現する。
export function MemberChangeModal({
  open,
  onClose,
  title,
  options,
  onToggle,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  options: MemberOption[];
  onToggle: (id: string) => void;
}) {
  const checkedCount = options.filter((o) => o.checked).length;

  return (
    <Modal open={open} onClose={onClose} title={title}>
      {options.length === 0 ? (
        <div className="text-xs text-ink-soft py-3">選手がいません</div>
      ) : (
        options.map((o) => {
          const dimmed = checkedCount >= 5 && !o.checked;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onToggle(o.id)}
              className={`w-full flex items-center py-2.5 px-2.5 -mx-2.5 rounded-lg border-b border-line last:border-b-0 text-left ${
                dimmed ? "opacity-40" : ""
              } ${o.checked ? "bg-orange/10" : ""}`}
            >
              <span className={`font-bold text-[13.5px] ${o.checked ? "text-orange" : "text-ink"}`}>{o.label}</span>
            </button>
          );
        })
      )}
    </Modal>
  );
}
