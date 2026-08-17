"use client";

import { useState } from "react";
import { REACTIONS } from "@/lib/reactions";
import type { ReactionType } from "@/lib/database.types";

interface ReactionRow {
  profile_id: string;
  reaction_type: ReactionType;
}

export function ReactionButtons({
  reactions,
  onToggle,
  profiles,
}: {
  reactions: ReactionRow[];
  onToggle: (type: ReactionType) => void;
  // 押した人の名前を表示するための一覧。渡さなければ従来通り件数だけの表示になる。
  profiles?: Record<string, string>;
}) {
  const [showNames, setShowNames] = useState(false);

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        {REACTIONS.map(({ type, src, alt }) => {
          const forTarget = reactions.filter((r) => r.reaction_type === type);
          const active = forTarget.length > 0;
          return (
            <button
              key={type}
              type="button"
              onClick={() => onToggle(type)}
              className={`flex items-center gap-1 px-2 py-1 rounded-full border ${
                active ? "border-orange bg-orange/8" : "border-line bg-paper"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={alt} className="w-4 h-4" />
              {active && <span className="text-[10.5px] font-bold text-orange">{forTarget.length}</span>}
            </button>
          );
        })}
        {profiles && reactions.length > 0 && (
          <button
            type="button"
            onClick={() => setShowNames((v) => !v)}
            className="text-[10.5px] text-ink-soft underline"
          >
            {showNames ? "閉じる" : "誰が押したか見る"}
          </button>
        )}
      </div>
      {showNames && profiles && (
        <div className="mt-1 space-y-0.5">
          {REACTIONS.map(({ type, alt }) => {
            const names = reactions.filter((r) => r.reaction_type === type).map((r) => profiles[r.profile_id] ?? "?");
            if (names.length === 0) return null;
            return (
              <div key={type} className="text-[10.5px] text-ink-soft">
                {alt} {names.join("・")}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
