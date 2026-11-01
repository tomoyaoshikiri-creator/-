"use client";

import { useActionState, useState } from "react";
import { createAdditionalTeam, type FormState } from "./actions";
import { SectionLabel, cardClass } from "@/components/ui/Card";
import { FieldLabel, SubmitButton, SubmitLinkButton, inputClass } from "@/components/ui/SegButton";
import { SPORTS, SPORT_DISPLAY_LABELS } from "@/lib/sport";
import { CATEGORIES, CATEGORY_DISPLAY_LABELS, isMiniBasketballAllowed } from "@/lib/category";
import type { TeamCategory } from "@/lib/database.types";

const initialState: FormState = {};

export function NewTeamForm() {
  const [state, formAction, pending] = useActionState(createAdditionalTeam, initialState);
  const [category, setCategory] = useState<TeamCategory>(CATEGORIES[0]);
  const availableSports = SPORTS.filter((s) => s !== "ミニバスケットボール" || isMiniBasketballAllowed(category));
  const [sport, setSport] = useState(SPORTS[0]);

  if (state.switchFailed) {
    return (
      <>
        <SectionLabel>新しいチームを作成</SectionLabel>
        <div className={cardClass}>
          <div className="text-[13px] text-ink-soft">
            チームは作成されましたが、この端末での切り替えに失敗しました。お手数ですが、下のボタンから手動でチームを切り替えてください。
          </div>
          <SubmitLinkButton href="/select-team">チームを切り替える</SubmitLinkButton>
        </div>
      </>
    );
  }

  return (
    <>
      <SectionLabel>新しいチームを作成</SectionLabel>
      <div className={cardClass}>
        <div className="text-xs text-ink-soft mb-4">
          新しいチームを作成すると、あなたはそのチームの管理者になります。今の氏名のまま、複数のチームに所属できます。
        </div>
        <form action={formAction}>
          <FieldLabel htmlFor="new-team-name">チーム名</FieldLabel>
          <input id="new-team-name" name="teamName" className={inputClass()} placeholder="例:〇〇クラブ" required />

          <div className="mt-3">
            <FieldLabel htmlFor="new-team-category">カテゴリー</FieldLabel>
            <select
              id="new-team-category"
              name="category"
              className={inputClass()}
              value={category}
              onChange={(e) => {
                const next = e.target.value as TeamCategory;
                setCategory(next);
                if (sport === "ミニバスケットボール" && !isMiniBasketballAllowed(next)) {
                  setSport("バスケットボール");
                }
              }}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_DISPLAY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3">
            <FieldLabel htmlFor="new-team-sport">競技</FieldLabel>
            <select
              id="new-team-sport"
              name="sport"
              className={inputClass()}
              value={sport}
              onChange={(e) => setSport(e.target.value as (typeof SPORTS)[number])}
            >
              {availableSports.map((s) => (
                <option key={s} value={s}>
                  {SPORT_DISPLAY_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          {state.error && <div className="mt-3 text-[12.5px] text-danger-text">{state.error}</div>}

          <SubmitButton type="submit" disabled={pending}>
            {pending ? "作成中…" : "チームを作成する"}
          </SubmitButton>
        </form>
      </div>
    </>
  );
}
