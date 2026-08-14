"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { Card, SectionLabel } from "@/components/ui/Card";
import { SegButton, SubmitButton, FieldLabel, inputClass } from "@/components/ui/SegButton";
import { useUnsavedChangesGuard } from "@/lib/navigationGuard";
import type { AttendanceStatus, CarStatus, YesNo } from "@/lib/database.types";

export function AttendanceEntryForm({
  scheduleId,
  userId,
  playerId,
  label,
  isGame,
  allowDelete = false,
  onChanged,
}: {
  scheduleId: string;
  userId: string;
  playerId: string | null;
  label: string;
  isGame: boolean;
  allowDelete?: boolean;
  onChanged?: () => void;
}) {
  const isSelf = playerId === null;
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<AttendanceStatus | null>(null);
  const [accompany, setAccompany] = useState<YesNo | null>(null);
  const [accompanyCount, setAccompanyCount] = useState("");
  const [car, setCar] = useState<CarStatus | null>(null);
  const [seats, setSeats] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // statusが選ばれているのにまだ(この内容で)保存されていない状態を「未保存」とみなす。
  useUnsavedChangesGuard(!loading && status !== null && !registered);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const supabase = createClient();
      // player_idがある場合、出欠の実体は選手単位(identity_key=player_id)なので、
      // 誰が登録したか(user_id)に関わらずその選手の記録を読み込む
      // (管理者が保護者の代わりに編集する場合や、選手に複数の保護者が紐付く場合に必要)。
      let query = supabase.from("attendances").select("*").eq("schedule_id", scheduleId);
      query = playerId ? query.eq("player_id", playerId) : query.eq("user_id", userId).is("player_id", null);
      const { data: a } = await query.maybeSingle();
      setStatus(a?.status ?? null);
      setAccompany(a?.accompany ?? null);
      setAccompanyCount(a?.accompany_count?.toString() ?? "");
      setCar(a?.car ?? null);
      setSeats(a?.seats?.toString() ?? "");
      setNote(a?.note ?? "");
      setRegistered(Boolean(a?.status));
      setLoading(false);
    })();
  }, [scheduleId, userId, playerId]);

  async function handleSubmit() {
    if (!status) {
      toast("出欠を選択してください");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("attendances").upsert(
      {
        schedule_id: scheduleId,
        user_id: userId,
        player_id: playerId,
        status,
        accompany: isGame && !isSelf ? accompany : null,
        accompany_count: isGame && !isSelf && accompany === "あり" && accompanyCount ? Number(accompanyCount) : null,
        car: isGame ? car : null,
        seats: isGame && car === "可" && seats ? Number(seats) : null,
        note: note || null,
      },
      { onConflict: "schedule_id,identity_key" },
    );
    setSaving(false);
    if (error) {
      toast(`保存に失敗しました: ${error.message}`);
      return;
    }
    toast("登録しました");
    setRegistered(true);
    onChanged?.();
  }

  async function handleDelete() {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(false), 3000);
      return;
    }
    setSaving(true);
    const supabase = createClient();
    let query = supabase.from("attendances").delete().eq("schedule_id", scheduleId).eq("user_id", userId);
    query = playerId ? query.eq("player_id", playerId) : query.is("player_id", null);
    const { error } = await query;
    setSaving(false);
    setDeleteConfirm(false);
    if (error) {
      toast(`削除に失敗しました: ${error.message}`);
      return;
    }
    toast("出欠を削除しました");
    setStatus(null);
    setAccompany(null);
    setAccompanyCount("");
    setCar(null);
    setSeats("");
    setNote("");
    setRegistered(false);
    onChanged?.();
  }

  return (
    <>
      <SectionLabel>{label}の出欠</SectionLabel>
      <Card>
        {loading ? (
          <div className="text-[12.5px] text-ink-soft text-center py-3">読み込み中…</div>
        ) : (
          <>
            <div className="flex gap-2 flex-wrap">
              <SegButton
                variant="small"
                active={status === "出席"}
                onClick={() => {
                  setStatus("出席");
                  setRegistered(false);
                }}
              >
                出席
              </SegButton>
              <SegButton
                variant="small"
                active={status === "欠席"}
                onClick={() => {
                  setStatus("欠席");
                  setRegistered(false);
                }}
              >
                欠席
              </SegButton>
              {!isGame && (
                <>
                  <SegButton
                    variant="small"
                    active={status === "遅刻早退"}
                    onClick={() => {
                      setStatus("遅刻早退");
                      setRegistered(false);
                    }}
                  >
                    遅刻早退
                  </SegButton>
                  <SegButton
                    variant="small"
                    active={status === "見学"}
                    onClick={() => {
                      setStatus("見学");
                      setRegistered(false);
                    }}
                  >
                    見学
                  </SegButton>
                </>
              )}
            </div>

            {isGame && (
              <>
                {!isSelf && (
                  <>
                    <div className="mt-3">
                      <FieldLabel>保護者の帯同</FieldLabel>
                      <div className="flex gap-2">
                        <SegButton
                          variant="small"
                          active={accompany === "あり"}
                          onClick={() => {
                            setAccompany("あり");
                            setRegistered(false);
                          }}
                        >
                          あり
                        </SegButton>
                        <SegButton
                          variant="small"
                          active={accompany === "なし"}
                          onClick={() => {
                            setAccompany("なし");
                            setRegistered(false);
                          }}
                        >
                          なし
                        </SegButton>
                      </div>
                    </div>
                    {accompany === "あり" && (
                      <div className="mt-3">
                        <FieldLabel>帯同人数</FieldLabel>
                        <input
                          type="number"
                          min={1}
                          className={inputClass()}
                          value={accompanyCount}
                          onChange={(e) => {
                            setAccompanyCount(e.target.value);
                            setRegistered(false);
                          }}
                          placeholder="例:2"
                        />
                      </div>
                    )}
                  </>
                )}

                <div className="mt-3">
                  <FieldLabel>車出し</FieldLabel>
                  <div className="flex gap-2">
                    <SegButton
                      variant="small"
                      active={car === "可"}
                      onClick={() => {
                        setCar("可");
                        setRegistered(false);
                      }}
                    >
                      可
                    </SegButton>
                    <SegButton
                      variant="small"
                      active={car === "不可"}
                      onClick={() => {
                        setCar("不可");
                        setRegistered(false);
                      }}
                    >
                      不可
                    </SegButton>
                  </div>
                </div>
                {car === "可" && (
                  <div className="mt-3">
                    <FieldLabel>乗車可能人数</FieldLabel>
                    <input
                      type="number"
                      min={0}
                      className={inputClass()}
                      value={seats}
                      onChange={(e) => {
                        setSeats(e.target.value);
                        setRegistered(false);
                      }}
                      placeholder="例:3"
                    />
                  </div>
                )}
              </>
            )}

            <div className="mt-3">
              <FieldLabel>備考</FieldLabel>
              <textarea
                rows={2}
                className={inputClass()}
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  setRegistered(false);
                }}
                placeholder="共有事項があれば記入"
              />
            </div>

            <SubmitButton
              onClick={handleSubmit}
              disabled={saving}
              className={`!py-2 !text-[12px] ${registered ? "opacity-45" : ""}`}
            >
              {saving ? "登録中…" : registered ? "登録済み(この内容で更新する)" : "この内容で登録する"}
            </SubmitButton>

            {allowDelete && registered && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="w-full mt-2.5 text-center py-2 rounded-[10px] font-bold text-[12.5px] border bg-white disabled:opacity-50"
                style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
              >
                {deleteConfirm ? "もう一度タップで削除確定" : "この出欠を削除する"}
              </button>
            )}
          </>
        )}
      </Card>
    </>
  );
}
