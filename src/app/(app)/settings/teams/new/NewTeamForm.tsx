"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createAdditionalTeam, type FormState } from "./actions";
import { Card, SectionLabel } from "@/components/ui/Card";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
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
        <Card>
          <div className="text-[13px] text-ink-soft">
            チームは作成されましたが、この端末での切り替えに失敗しました。お手数ですが、下のボタンから手動でチームを切り替えてください。
          </div>
          <Link
            href="/select-team"
            className="mt-3.5 block w-full py-2.5 rounded-lg bg-navy text-white font-bold text-[13px] text-center active:opacity-85"
          >
            チームを切り替える
          </Link>
        </Card>
      </>
    );
  }

  return (
    <>
      <SectionLabel>新しいチームを作成</SectionLabel>
      <Card>
        <div className="text-xs text-ink-soft mb-4">
          新しいチームを作成すると、あなたはそのチームの管理者になります。今の氏名のまま、複数のチームに所属できます。
        </div>
        <form action={formAction}>
          <FieldLabel>チーム名</FieldLabel>
          <input name="teamName" className={inputClass()} placeholder="例:〇〇クラブ" required />

          <div className="mt-3">
            <FieldLabel>カテゴリー</FieldLabel>
            <select
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
            <FieldLabel>競技</FieldLabel>
            <select
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

          {state.error && <div className="mt-3 text-[12.5px] text-danger">{state.error}</div>}

          <SubmitButton type="submit" disabled={pending}>
            {pending ? "作成中…" : "チームを作成する"}
          </SubmitButton>
        </form>
      </Card>
    </>
  );
}
