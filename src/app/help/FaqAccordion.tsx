"use client";

import { useState } from "react";
import type { FaqCategory } from "@/content/faq";

// アクセシブルな開閉式(アコーディオン)。button+aria-expandedで実装し、キーボード操作
// (Tab+Enter/Space)はネイティブのbutton要素の挙動にそのまま任せる(独自のkeydown
// ハンドリングは持たない)。開閉状態はカテゴリーをまたいで共有せず項目ごとに独立。
export function FaqAccordion({ categories }: { categories: FaqCategory[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <>
      {categories.map((category) => (
        <section key={category.id} id={category.id} className="mb-8 scroll-mt-6">
          <h2 className="font-bold text-[16px] mb-3 pb-2 border-b border-line">{category.title}</h2>
          <div className="space-y-2">
            {category.items.map((item) => {
              const expanded = openId === item.id;
              const panelId = `faq-panel-${item.id}`;
              const buttonId = `faq-button-${item.id}`;
              return (
                <div key={item.id} className="rounded-lg border border-line bg-white overflow-hidden">
                  <button
                    type="button"
                    id={buttonId}
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={() => setOpenId(expanded ? null : item.id)}
                    className="w-full flex items-center justify-between gap-3 text-left px-4 py-3 font-bold text-[13.5px]"
                  >
                    <span>{item.question}</span>
                    <span aria-hidden className={`flex-none text-ink-soft transition-transform ${expanded ? "rotate-45" : ""}`}>
                      +
                    </span>
                  </button>
                  {expanded && (
                    <div id={panelId} role="region" aria-labelledby={buttonId} className="px-4 pb-4 text-[12.5px] text-ink leading-relaxed">
                      {item.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
