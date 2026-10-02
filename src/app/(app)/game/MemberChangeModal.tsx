"use client";

import { Modal } from "@/components/ui/Modal";

export interface MemberOption {
  id: string;
  label: string;
  checked: boolean;
  // 5ファウルに達し退場となった選手。出場中(checked)なら交代で外すことはできるが、
  // 一度外れた後は再び出場選手として選べない。
  disqualified?: boolean;
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
    <Modal open={open} onClose={onClose} title={title} maxWidthClass="max-w-[340px]">
      {options.length === 0 ? (
        <div className="text-xs text-ink-soft py-3">選手がいません</div>
      ) : (
        options.map((o) => {
          // 退場した選手は、出場中(交代で外す)でなければ再選択できない。
          const blocked = !o.checked && !!o.disqualified;
          const dimmed = blocked || (checkedCount >= 5 && !o.checked);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                if (!blocked) onToggle(o.id);
              }}
              className={`w-full flex items-center justify-between py-2.5 px-2.5 -mx-2.5 rounded-lg border-b border-line last:border-b-0 text-left ${
                dimmed ? "opacity-40" : ""
              } ${o.checked ? "bg-orange/10" : ""}`}
            >
              <span className={`font-bold text-[13.5px] ${o.checked ? "text-orange" : "text-ink"}`}>{o.label}</span>
              {o.disqualified && (
                <span className="flex-none text-[10.5px] font-bold text-danger ml-2">5ファウル退場</span>
              )}
            </button>
          );
        })
      )}
      <div className="flex justify-end mt-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg font-bold text-[12.5px] border border-line text-ink-soft bg-paper"
        >
          閉じる
        </button>
      </div>
    </Modal>
  );
}
