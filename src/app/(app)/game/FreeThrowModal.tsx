"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { SegButton } from "@/components/ui/SegButton";

// HOOP Jのフリースロー入力を参考にした画面。本数(1〜3)を選んでから、
// ショットごとに成功/失敗を選び、まとめて保存する。
export function FreeThrowModal({
  open,
  onClose,
  entrantLabel,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  entrantLabel: string;
  onSave: (results: boolean[]) => void;
}) {
  const [shotCount, setShotCount] = useState<1 | 2 | 3>(1);
  const [results, setResults] = useState<(boolean | null)[]>([null]);

  useEffect(() => {
    if (open) {
      setShotCount(1);
      setResults([null]);
    }
  }, [open]);

  function changeShotCount(n: 1 | 2 | 3) {
    setShotCount(n);
    setResults((prev) => {
      const next = [...prev];
      while (next.length < n) next.push(null);
      return next.slice(0, n);
    });
  }

  function setResult(index: number, made: boolean) {
    setResults((prev) => prev.map((r, i) => (i === index ? made : r)));
  }

  const canSave = results.every((r) => r !== null);

  function handleSave() {
    if (!canSave) return;
    onSave(results as boolean[]);
  }

  return (
    <Modal open={open} onClose={onClose} title="フリースロー">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={onClose} className="text-orange font-bold text-[13px]">
          キャンセル
        </button>
        <div className="font-bold text-[13.5px]">{entrantLabel}</div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="text-orange font-bold text-[13px] disabled:opacity-30"
        >
          保存
        </button>
      </div>

      <div className="flex gap-1.5 mb-3">
        {[1, 2, 3].map((n) => (
          <SegButton
            key={n}
            active={shotCount === n}
            onClick={() => changeShotCount(n as 1 | 2 | 3)}
            className="flex-1"
          >
            {n}
          </SegButton>
        ))}
      </div>

      {results.map((r, i) => (
        <div key={i} className="flex items-center gap-2.5 py-2 border-b border-line last:border-b-0">
          <div className="font-mono text-[12.5px] font-bold text-ink-soft w-4">{i + 1}</div>
          <button
            type="button"
            onClick={() => setResult(i, false)}
            className={`flex-1 py-1.5 rounded-[8px] font-bold text-[12.5px] border ${
              r === false ? "border-orange bg-orange text-white" : "border-line text-ink bg-white"
            }`}
          >
            失敗
          </button>
          <button
            type="button"
            onClick={() => setResult(i, true)}
            className={`flex-1 py-1.5 rounded-[8px] font-bold text-[12.5px] border ${
              r === true ? "border-orange bg-orange text-white" : "border-line text-ink bg-white"
            }`}
          >
            成功
          </button>
        </div>
      ))}
    </Modal>
  );
}
