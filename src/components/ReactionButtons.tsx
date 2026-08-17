"use client";

import { useRef, useState } from "react";
import { REACTIONS } from "@/lib/reactions";
import type { ReactionType } from "@/lib/database.types";

interface ReactionRow {
  profile_id: string;
  reaction_type: ReactionType;
}

const LONG_PRESS_MS = 450;
const AUTO_CLOSE_MS = 4000;

export function ReactionButtons({
  reactions,
  onToggle,
  profiles,
}: {
  reactions: ReactionRow[];
  onToggle: (type: ReactionType) => void;
  // 押した人の名前を表示するための一覧。渡さなければ従来通りタップで反応を切り替えるだけになる。
  profiles?: Record<string, string>;
}) {
  const [expandedType, setExpandedType] = useState<ReactionType | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  function startPress(type: ReactionType, count: number) {
    longPressFired.current = false;
    pressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      if (!profiles || count === 0) return;
      setExpandedType((cur) => (cur === type ? null : type));
      if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
      autoCloseTimer.current = setTimeout(() => setExpandedType(null), AUTO_CLOSE_MS);
    }, LONG_PRESS_MS);
  }

  function cancelPress() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  function handleClick(type: ReactionType) {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    onToggle(type);
  }

  const expandedNames =
    expandedType &&
    reactions.filter((r) => r.reaction_type === expandedType).map((r) => profiles?.[r.profile_id] ?? "?");
  const expandedAlt = REACTIONS.find((r) => r.type === expandedType)?.alt;

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
              onPointerDown={() => startPress(type, forTarget.length)}
              onPointerUp={cancelPress}
              onPointerLeave={cancelPress}
              onPointerCancel={cancelPress}
              onClick={() => handleClick(type)}
              className={`flex items-center gap-1 px-2 py-1 rounded-full border select-none ${
                active ? "border-orange bg-orange/8" : "border-line bg-paper"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={alt} className="w-4 h-4" />
              {active && <span className="text-[10.5px] font-bold text-orange">{forTarget.length}</span>}
            </button>
          );
        })}
      </div>
      {expandedNames && expandedNames.length > 0 && (
        <div className="mt-1 text-[10.5px] text-ink-soft">
          {expandedAlt} {expandedNames.join("・")}
        </div>
      )}
    </div>
  );
}
