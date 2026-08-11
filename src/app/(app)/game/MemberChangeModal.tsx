"use client";

import { Modal } from "@/components/ui/Modal";

export interface MemberOption {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
}

// 試合中に発生する途中交代を、スタッツ入力画面からその場で反映するための選手選択モーダル。
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
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {options.length === 0 ? (
        <div className="text-xs text-ink-soft py-3">選手がいません</div>
      ) : (
        options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => !o.disabled && onToggle(o.id)}
            disabled={o.disabled}
            className={`w-full flex items-center gap-2.5 py-2.5 border-b border-line last:border-b-0 text-left ${
              o.disabled ? "opacity-40" : ""
            }`}
          >
            <span
              className={`w-[22px] h-[22px] rounded-md border flex items-center justify-center flex-shrink-0 font-bold text-[13px] ${
                o.checked ? "bg-orange border-orange text-white" : "border-line"
              }`}
            >
              {o.checked ? "✓" : ""}
            </span>
            <span className="font-bold text-[13.5px]">{o.label}</span>
          </button>
        ))
      )}
    </Modal>
  );
}
